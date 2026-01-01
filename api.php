<?php
/**
 * FeedFlow RSS Reader API
 * Free Open Source RSS Reader
 * https://github.com/Jaseph/feedflow
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

define('DATA_DIR', __DIR__ . '/data');
define('CACHE_DIR', DATA_DIR . '/cache');
define('FEEDS_FILE', DATA_DIR . '/feeds.json');

// Ensure directories exist
if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

/**
 * Load feeds configuration
 */
function loadFeeds(): array {
    if (!file_exists(FEEDS_FILE)) {
        return ['feeds' => [], 'settings' => ['cacheMinutes' => 15, 'itemsPerPage' => 20, 'theme' => 'auto']];
    }
    return json_decode(file_get_contents(FEEDS_FILE), true) ?: ['feeds' => [], 'settings' => []];
}

/**
 * Save feeds configuration
 */
function saveFeeds(array $data): bool {
    return file_put_contents(FEEDS_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
}

/**
 * Get cached feed or fetch fresh
 */
function getFeed(string $feedId, string $url, int $cacheMinutes = 15): ?array {
    $cacheFile = CACHE_DIR . '/' . md5($feedId) . '.json';

    // Check cache
    if (file_exists($cacheFile)) {
        $cacheAge = (time() - filemtime($cacheFile)) / 60;
        if ($cacheAge < $cacheMinutes) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached) {
                $cached['fromCache'] = true;
                $cached['cacheAge'] = round($cacheAge);
                return $cached;
            }
        }
    }

    // Fetch fresh
    $feed = fetchRSS($url);
    if ($feed) {
        $feed['feedId'] = $feedId;
        $feed['fetchedAt'] = date('c');
        $feed['fromCache'] = false;
        file_put_contents($cacheFile, json_encode($feed, JSON_UNESCAPED_UNICODE));
        return $feed;
    }

    // Return stale cache if fetch failed
    if (file_exists($cacheFile)) {
        $cached = json_decode(file_get_contents($cacheFile), true);
        if ($cached) {
            $cached['fromCache'] = true;
            $cached['stale'] = true;
            return $cached;
        }
    }

    return null;
}

/**
 * Parse RSS/Atom feed
 */
function fetchRSS(string $url): ?array {
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'user_agent' => 'FeedFlow RSS Reader/1.0 (+https://europa.tips)',
            'follow_location' => true
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $content = @file_get_contents($url, false, $context);
    if (!$content) {
        return null;
    }

    // Suppress XML errors
    libxml_use_internal_errors(true);
    $xml = simplexml_load_string($content);
    if (!$xml) {
        return null;
    }

    $items = [];
    $feedTitle = '';
    $feedLink = '';
    $feedDescription = '';

    // RSS 2.0
    if (isset($xml->channel)) {
        $channel = $xml->channel;
        $feedTitle = (string)$channel->title;
        $feedLink = (string)$channel->link;
        $feedDescription = (string)$channel->description;

        foreach ($channel->item as $item) {
            $items[] = parseRSSItem($item);
        }
    }
    // Atom
    elseif ($xml->getName() === 'feed') {
        $feedTitle = (string)$xml->title;
        $feedLink = (string)($xml->link['href'] ?? $xml->link);
        $feedDescription = (string)$xml->subtitle;

        foreach ($xml->entry as $entry) {
            $items[] = parseAtomEntry($entry);
        }
    }

    return [
        'title' => $feedTitle,
        'link' => $feedLink,
        'description' => $feedDescription,
        'items' => $items,
        'itemCount' => count($items)
    ];
}

/**
 * Parse RSS item
 */
function parseRSSItem($item): array {
    $namespaces = $item->getNamespaces(true);

    // Get media/enclosure image
    $image = '';
    if (isset($item->enclosure) && strpos((string)$item->enclosure['type'], 'image') !== false) {
        $image = (string)$item->enclosure['url'];
    }

    // Try media:content
    if (!$image && isset($namespaces['media'])) {
        $media = $item->children($namespaces['media']);
        if (isset($media->content)) {
            $image = (string)$media->content['url'];
        } elseif (isset($media->thumbnail)) {
            $image = (string)$media->thumbnail['url'];
        }
    }

    // Extract image from content/description
    if (!$image) {
        $content = (string)($item->children('content', true)->encoded ?? $item->description);
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $content, $m)) {
            $image = $m[1];
        }
    }

    $description = strip_tags((string)$item->description);
    if (strlen($description) > 200) {
        $description = mb_substr($description, 0, 200) . '...';
    }

    return [
        'title' => (string)$item->title,
        'link' => (string)$item->link,
        'description' => $description,
        'pubDate' => (string)$item->pubDate,
        'timestamp' => strtotime((string)$item->pubDate) ?: time(),
        'image' => $image,
        'author' => (string)($item->author ?? $item->children('dc', true)->creator ?? ''),
        'categories' => array_map('strval', (array)($item->category ?? []))
    ];
}

/**
 * Parse Atom entry
 */
function parseAtomEntry($entry): array {
    $link = '';
    foreach ($entry->link as $l) {
        if ((string)$l['rel'] === 'alternate' || empty($l['rel'])) {
            $link = (string)$l['href'];
            break;
        }
    }
    if (!$link && isset($entry->link['href'])) {
        $link = (string)$entry->link['href'];
    }

    $description = strip_tags((string)($entry->summary ?? $entry->content));
    if (strlen($description) > 200) {
        $description = mb_substr($description, 0, 200) . '...';
    }

    // Get image from content
    $image = '';
    $content = (string)($entry->content ?? $entry->summary);
    if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $content, $m)) {
        $image = $m[1];
    }

    return [
        'title' => (string)$entry->title,
        'link' => $link,
        'description' => $description,
        'pubDate' => (string)($entry->published ?? $entry->updated),
        'timestamp' => strtotime((string)($entry->published ?? $entry->updated)) ?: time(),
        'image' => $image,
        'author' => (string)($entry->author->name ?? ''),
        'categories' => []
    ];
}

/**
 * Validate URL
 */
function isValidFeedUrl(string $url): bool {
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        return false;
    }
    $parsed = parse_url($url);
    return isset($parsed['scheme']) && in_array($parsed['scheme'], ['http', 'https']);
}

/**
 * Generate unique feed ID
 */
function generateFeedId(): string {
    return 'feed_' . bin2hex(random_bytes(8));
}

// Router
$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'feeds':
            // Get all feeds list
            $data = loadFeeds();
            echo json_encode([
                'success' => true,
                'feeds' => $data['feeds'],
                'settings' => $data['settings']
            ]);
            break;

        case 'articles':
            // Get articles from all or specific feeds
            $data = loadFeeds();
            $feedIds = isset($_GET['feeds']) ? explode(',', $_GET['feeds']) : null;
            $page = max(1, (int)($_GET['page'] ?? 1));
            $perPage = (int)($data['settings']['itemsPerPage'] ?? 20);
            $search = trim($_GET['search'] ?? '');

            $allItems = [];
            $feedMap = [];

            foreach ($data['feeds'] as $feed) {
                $feedMap[$feed['id']] = $feed;

                // Skip if filtering by specific feeds
                if ($feedIds !== null && !in_array($feed['id'], $feedIds)) {
                    continue;
                }

                $feedData = getFeed($feed['id'], $feed['url'], $data['settings']['cacheMinutes'] ?? 15);
                if ($feedData && !empty($feedData['items'])) {
                    foreach ($feedData['items'] as $item) {
                        $item['feedId'] = $feed['id'];
                        $item['feedTitle'] = $feed['title'];
                        $item['feedIcon'] = $feed['icon'] ?? '';
                        $allItems[] = $item;
                    }
                }
            }

            // Search filter
            if ($search) {
                $searchLower = mb_strtolower($search);
                $allItems = array_filter($allItems, function($item) use ($searchLower) {
                    return mb_strpos(mb_strtolower($item['title']), $searchLower) !== false ||
                           mb_strpos(mb_strtolower($item['description']), $searchLower) !== false;
                });
                $allItems = array_values($allItems);
            }

            // Sort by date (newest first)
            usort($allItems, fn($a, $b) => $b['timestamp'] - $a['timestamp']);

            // Paginate
            $total = count($allItems);
            $totalPages = ceil($total / $perPage);
            $offset = ($page - 1) * $perPage;
            $items = array_slice($allItems, $offset, $perPage);

            echo json_encode([
                'success' => true,
                'items' => $items,
                'pagination' => [
                    'page' => $page,
                    'perPage' => $perPage,
                    'total' => $total,
                    'totalPages' => $totalPages
                ]
            ]);
            break;

        case 'add':
            // Add new feed
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $url = trim($input['url'] ?? '');
            $title = trim($input['title'] ?? '');
            $category = trim($input['category'] ?? 'Uncategorized');
            $icon = trim($input['icon'] ?? '📰');

            if (!isValidFeedUrl($url)) {
                throw new Exception('Invalid URL');
            }

            // Verify it's a valid feed
            $testFeed = fetchRSS($url);
            if (!$testFeed) {
                throw new Exception('Could not parse feed');
            }

            // Use feed title if not provided
            if (!$title) {
                $title = $testFeed['title'] ?: 'Untitled Feed';
            }

            $data = loadFeeds();

            // Check for duplicate URL
            foreach ($data['feeds'] as $feed) {
                if ($feed['url'] === $url) {
                    throw new Exception('Feed already exists');
                }
            }

            $newFeed = [
                'id' => generateFeedId(),
                'title' => $title,
                'url' => $url,
                'category' => $category,
                'icon' => $icon
            ];

            $data['feeds'][] = $newFeed;
            saveFeeds($data);

            echo json_encode([
                'success' => true,
                'feed' => $newFeed,
                'message' => 'Feed added successfully'
            ]);
            break;

        case 'remove':
            // Remove feed
            if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
                throw new Exception('Method not allowed');
            }

            $input = json_decode(file_get_contents('php://input'), true);
            $feedId = $input['id'] ?? '';

            if (!$feedId) {
                throw new Exception('Feed ID required');
            }

            $data = loadFeeds();
            $data['feeds'] = array_values(array_filter($data['feeds'], fn($f) => $f['id'] !== $feedId));
            saveFeeds($data);

            // Remove cache
            $cacheFile = CACHE_DIR . '/' . md5($feedId) . '.json';
            if (file_exists($cacheFile)) {
                unlink($cacheFile);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Feed removed successfully'
            ]);
            break;

        case 'refresh':
            // Force refresh a feed
            $feedId = $_GET['id'] ?? '';
            $data = loadFeeds();

            $feed = null;
            foreach ($data['feeds'] as $f) {
                if ($f['id'] === $feedId) {
                    $feed = $f;
                    break;
                }
            }

            if (!$feed) {
                throw new Exception('Feed not found');
            }

            // Clear cache
            $cacheFile = CACHE_DIR . '/' . md5($feedId) . '.json';
            if (file_exists($cacheFile)) {
                unlink($cacheFile);
            }

            // Fetch fresh
            $feedData = getFeed($feedId, $feed['url'], 0);

            echo json_encode([
                'success' => true,
                'feed' => $feedData
            ]);
            break;

        case 'settings':
            // Update settings
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $input = json_decode(file_get_contents('php://input'), true);
                $data = loadFeeds();
                $data['settings'] = array_merge($data['settings'], $input);
                saveFeeds($data);
                echo json_encode(['success' => true, 'settings' => $data['settings']]);
            } else {
                $data = loadFeeds();
                echo json_encode(['success' => true, 'settings' => $data['settings']]);
            }
            break;

        case 'export':
            // Export as OPML
            $data = loadFeeds();
            header('Content-Type: application/xml; charset=utf-8');
            header('Content-Disposition: attachment; filename="feedflow-export.opml"');

            echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
            echo '<opml version="2.0">' . "\n";
            echo '  <head><title>FeedFlow Export</title></head>' . "\n";
            echo '  <body>' . "\n";

            $categories = [];
            foreach ($data['feeds'] as $feed) {
                $cat = $feed['category'] ?? 'Uncategorized';
                $categories[$cat][] = $feed;
            }

            foreach ($categories as $catName => $feeds) {
                echo '    <outline text="' . htmlspecialchars($catName) . '">' . "\n";
                foreach ($feeds as $feed) {
                    echo '      <outline type="rss" text="' . htmlspecialchars($feed['title']) . '" xmlUrl="' . htmlspecialchars($feed['url']) . '"/>' . "\n";
                }
                echo '    </outline>' . "\n";
            }

            echo '  </body>' . "\n";
            echo '</opml>';
            exit;

        default:
            echo json_encode([
                'success' => true,
                'name' => 'FeedFlow RSS Reader API',
                'version' => '1.0.0',
                'endpoints' => [
                    'GET ?action=feeds' => 'List all feeds',
                    'GET ?action=articles' => 'Get articles (optional: feeds, page, search)',
                    'POST ?action=add' => 'Add new feed',
                    'POST ?action=remove' => 'Remove feed',
                    'GET ?action=refresh&id=X' => 'Refresh feed cache',
                    'GET/POST ?action=settings' => 'Get/update settings',
                    'GET ?action=export' => 'Export feeds as OPML'
                ]
            ]);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
