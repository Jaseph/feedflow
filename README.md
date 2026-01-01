<p align="center">
  <img src="https://raw.githubusercontent.com/Jaseph/feedflow/main/assets/logo.png" alt="FeedFlow Logo" width="120">
</p>

<h1 align="center">FeedFlow</h1>

<p align="center">
  <strong>Free, open source, self-hosted RSS reader</strong><br>
  No database required. Modern UI with dark mode. Privacy-friendly.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://php.net"><img src="https://img.shields.io/badge/PHP-7.4+-777BB4.svg" alt="PHP 7.4+"></a>
  <a href="https://github.com/Jaseph/feedflow/stargazers"><img src="https://img.shields.io/github/stars/Jaseph/feedflow.svg" alt="GitHub stars"></a>
  <a href="https://github.com/Jaseph/feedflow/issues"><img src="https://img.shields.io/github/issues/Jaseph/feedflow.svg" alt="GitHub issues"></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#installation">Installation</a> •
  <a href="#api">API</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/Jaseph/feedflow/main/screenshot.png" alt="FeedFlow Screenshot" width="800">
</p>

## Features

- **100% Free & Open Source** - MIT licensed, use it anywhere
- **Self-Hosted** - Your data stays on your server
- **No Database Required** - Uses JSON files for storage
- **Modern UI** - Clean, responsive design
- **Dark & Light Mode** - Easy on the eyes, day or night
- **RSS & Atom Support** - Works with all major feed formats
- **Smart Caching** - Configurable cache for fast performance
- **OPML Export** - Easy backup and migration
- **Search** - Find articles across all your feeds
- **Categories** - Organize feeds into groups
- **Mobile Friendly** - Works great on phones and tablets
- **Keyboard Shortcuts** - Power user friendly
- **Privacy First** - Zero tracking, zero analytics
- **No Dependencies** - Pure PHP and vanilla JavaScript

## Demo

Try the live demo: [europa.tips](https://europa.tips)

## Installation

### Requirements

- PHP 7.4 or higher
- SimpleXML extension (enabled by default on most servers)
- Web server (Apache, Nginx, or any PHP-capable server)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jaseph/feedflow.git
   cd feedflow
   ```

2. **Set permissions**
   ```bash
   chmod 755 data
   chmod 755 data/cache
   ```

3. **Upload to your server** (or run locally)
   ```bash
   # Using PHP built-in server for testing
   php -S localhost:8000
   ```

4. **Open in browser**
   ```
   http://localhost:8000
   ```

That's it! Start adding your feeds.

### Docker

```bash
docker run -d -p 8080:80 -v ./data:/var/www/html/data jaseph/feedflow
```

Or with docker-compose:

```yaml
version: '3'
services:
  feedflow:
    image: jaseph/feedflow
    ports:
      - "8080:80"
    volumes:
      - ./data:/var/www/html/data
```

## Configuration

Edit `data/feeds.json` to configure settings:

```json
{
  "feeds": [],
  "settings": {
    "cacheMinutes": 15,
    "itemsPerPage": 20,
    "theme": "auto"
  }
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `cacheMinutes` | How long to cache feeds (in minutes) | `15` |
| `itemsPerPage` | Number of articles per page | `20` |
| `theme` | Color theme (`auto`, `light`, `dark`) | `auto` |

## API

FeedFlow includes a simple REST API for managing feeds.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `api.php?action=feeds` | List all feeds |
| `GET` | `api.php?action=articles` | Get articles |
| `POST` | `api.php?action=add` | Add new feed |
| `POST` | `api.php?action=remove` | Remove feed |
| `GET` | `api.php?action=refresh&id=X` | Refresh specific feed |
| `GET/POST` | `api.php?action=settings` | Get or update settings |
| `GET` | `api.php?action=export` | Export feeds as OPML |

### Examples

**Get all articles:**
```bash
curl "http://localhost/feedflow/api.php?action=articles"
```

**Add a new feed:**
```bash
curl -X POST "http://localhost/feedflow/api.php?action=add" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/rss", "title": "My Feed", "category": "News"}'
```

**Get articles with pagination:**
```bash
curl "http://localhost/feedflow/api.php?action=articles&page=2&search=keyword"
```

### Response Format

All API responses return JSON:

```json
{
  "success": true,
  "items": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search box |
| `Esc` | Close modals |

## File Structure

```
feedflow/
├── index.html          # Main application
├── api.php             # Backend API
├── css/
│   └── style.css       # Styles (light & dark mode)
├── js/
│   └── app.js          # Frontend JavaScript
├── data/
│   ├── feeds.json      # Feed configuration
│   └── cache/          # Cached feed data
└── README.md
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome for Android)

## Roadmap

- [ ] OPML Import
- [ ] Feed favicons
- [ ] Article bookmarks
- [ ] Read/unread tracking
- [ ] PWA support
- [ ] Multi-user support

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please make sure to:
- Follow the existing code style
- Test your changes thoroughly
- Update documentation if needed

## Security

FeedFlow is designed with privacy in mind:

- No tracking or analytics
- No external requests (except for fetching feeds)
- No cookies for tracking
- All data stored locally on your server
- No user accounts or authentication (single-user by design)

If you discover a security vulnerability, please open an issue or contact us directly.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Jaseph

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## Acknowledgments

- Demo feeds provided by [Europa.Tips](https://europa.tips)
- Icons by [Font Awesome](https://fontawesome.com)

---

<p align="center">
  <strong>If you find FeedFlow useful, please consider giving it a ⭐ on GitHub!</strong>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/Jaseph">Jaseph</a>
</p>
