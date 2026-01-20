# TopGG Auto Vote Service

Automated voting service for TopGG using Discord authentication. Supports scheduled voting, state persistence, and Docker deployment.

## Features

- **Automated Voting**: Schedule votes every 12 hours (configurable)
- **Multi-Account Support**: Use multiple Discord tokens
- **State Persistence**: Resume voting after restarts
- **Browser Automation**: Chrome/Chromium with Puppeteer
- **Cloudflare Bypass**: Stealth mode for challenging protections
- **Docker Ready**: Production-ready containerization
- **Screenshot Debugging**: Capture failures for analysis
- **Rotational Logging**: Winston with daily rotation

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Clone and navigate
git clone <repo-url>
cd topgg-auto-vote

# 2. Configure environment
cp config/docker.env.example config/docker.env
nano config/docker.env  # Add your Discord tokens

# 3. Create directories
mkdir -p data logs screenshots

# 4. Build and run
docker-compose up -d

# 5. Check logs
docker-compose logs -f
```

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp config/.env.example config/.env
nano config/.env  # Add your Discord tokens

# 3. Build
npm run build

# 4. Test manually (optional)
npm run test:manual

# 5. Start service
npm start
```

## Configuration

### Environment Variables

Edit `config/.env` (local) or `config/docker.env` (Docker):

```env
# REQUIRED: Discord tokens (comma-separated)
DISCORD_TOKENS=your_token_1,your_token_2

# REQUIRED: TopGG Bot ID
TOPGG_BOT_ID=408785106942164992

# OPTIONAL: Vote interval in hours (default: 12)
VOTE_INTERVAL_HOURS=12

# OPTIONAL: Log level (error, warn, info, debug)
LOG_LEVEL=info

# OPTIONAL: Headless mode (true/false)
HEADLESS=true
```

## Getting Discord Tokens

### Method 1: Discord Browser (Recommended)

1. Open Discord in browser (Chrome/Edge)
2. Press F12 (Developer Tools)
3. Go to Application/Storage → Local Storage
4. Find `https://discord.com`
5. Copy the token value

### Method 2: Discord Desktop App

1. Press Ctrl+Shift+I (Windows) or Cmd+Option+I (Mac)
2. Go to Application → Local Storage
3. Find `https://discord.com`
4. Copy token from localStorage

**Security Note**: Never share your tokens. They provide full account access.

## Usage

### Manual Testing

Test voting with a single token:

```bash
npm run build
npm run test:manual
```

This will:
- Launch browser
- Authenticate with Discord
- Submit vote
- Report result
- Close browser

### Automated Scheduling

Start the service:

```bash
# Local
npm start

# Docker
docker-compose up -d
```

The service will:
- Load previous voting state
- Schedule next vote
- Execute at scheduled time
- Save state after each vote

### Monitoring

View logs:

```bash
# Local (logs in ./logs directory)
tail -f logs/combined-*.log

# Docker
docker-compose logs -f
```

Check voting state:

```bash
# View state file
cat data/vote-state.json

# Format JSON (if jq installed)
cat data/vote-state.json | jq '.'
```

## Development

### Project Structure

```
topgg-auto-vote/
├── src/
│   ├── services/          # Core services
│   │   ├── BrowserService.ts
│   │   ├── DiscordAuthService.ts
│   │   ├── VoteService.ts
│   │   ├── SchedulerService.ts
│   │   └── StateManager.ts
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilities
│   └── index.ts           # Entry point
├── test/                  # Test files
├── config/                # Configuration
├── dist/                  # Build output
└── logs/                  # Log files
```

### Scripts

```bash
npm run dev          # Development mode with hot reload
npm run build        # Build TypeScript
npm run start        # Production start
npm run lint         # Lint code
npm run format       # Format code
npm run test         # Run unit tests
npm run test:watch   # Watch mode tests
npm run test:manual  # Manual vote test
```

### Docker Commands

```bash
make build           # Build image
make run             # Start container
make logs            # View logs
make stop            # Stop container
make rebuild         # Rebuild and restart
make shell           # Shell into container
make ps              # Check status
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Build first
npm run build

# Run manual test
npm run test:manual
```

### Docker Testing

```bash
# Build container
docker-compose build

# Run in foreground (see logs)
docker-compose up

# Check for errors
docker-compose logs | grep -i error

# Verify state file
cat data/vote-state.json
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed debugging guide.

### Common Issues

**Vote fails with "Token Invalid"**
- Verify token format (should start with user prefix)
- Check for extra spaces/quotes in .env file
- Regenerate token if expired

**Browser crashes**
- Increase Docker memory limit
- Ensure sufficient disk space
- Check Chrome flags in docker-compose.yml

**Turnstile timeout**
- Check screenshot in `screenshots/` directory
- May need manual CAPTCHA solving
- Consider CAPTCHA solving service

**Container won't start**
- Check environment file syntax
- Verify Docker daemon running
- Review logs: `docker-compose logs`

## Deployment

### Production Checklist

- [ ] Discord tokens validated
- [ ] Bot ID confirmed (408785106942164992)
- [ ] Vote URL accessible
- [ ] Local testing passed
- [ ] Docker build successful
- [ ] Environment variables configured
- [ ] Volume directories created
- [ ] Log rotation configured
- [ ] Resource limits set

### Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Monitor startup
docker-compose logs -f

# Verify health
docker-compose ps
```

### Monitoring

Check logs regularly:

```bash
# View recent logs
docker-compose logs --tail=50

# Follow logs
docker-compose logs -f

# Check for errors
docker-compose logs | grep -i error
```

Monitor state:

```bash
# Check next vote time
cat data/vote-state.json | jq '.nextVoteTime'

# Check vote count
cat data/vote-state.json | jq '.voteCount'
```

## Maintenance

### Daily

- Check logs for errors
- Verify vote occurred

### Weekly

- Review disk usage
- Check consecutive failure count
- Archive old logs

### Monthly

- Rotate Discord tokens
- Update dependencies
- Clean old screenshots

## Security

- **Never commit** `.env` files
- Use **read-only volumes** where possible
- **Limit container resources**
- Use **non-root user** in container
- **Rotate tokens regularly**
- Monitor for **suspicious activity**

## Architecture

The service uses a modular architecture:

- **BrowserService**: Manages Chrome lifecycle
- **DiscordAuthService**: Handles Discord login
- **VoteService**: Orchestrates voting flow
- **SchedulerService**: Cron-based scheduling
- **StateManager**: Persistent state management

See [DOCKER.md](DOCKER.md) for architecture details.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review logs: `docker-compose logs`
3. Verify configuration: `cat config/docker.env`
4. Check GitHub issues

## Acknowledgments

- Built for [OwO Bot](https://top.gg/bot/408785106942164992)
- Uses [Puppeteer](https://github.com/puppeteer/puppeteer)
- Powered by [Node.js](https://nodejs.org/)
