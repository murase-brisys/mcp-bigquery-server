# BigQuery MCP Server
<div align="center">
  <img src="assets/mcp-bigquery-server-logo.png" alt="BigQuery MCP Server Logo" width="400"/>
</div>

## What is this? 🤔

This is a server that lets your LLMs (like Claude) talk directly to your BigQuery data! Think of it as a friendly translator that sits between your AI assistant and your database, making sure they can chat securely and efficiently.

### Quick Example
```text
You: "What were our top 10 customers last month?"
Claude: *queries your BigQuery database and gives you the answer in plain English*
```

No more writing SQL queries by hand - just chat naturally with your data!

## How Does It Work? 🛠️

This server uses the Model Context Protocol (MCP), which is like a universal translator for AI-database communication. While MCP is designed to work with any AI model, right now it's available as a developer preview in Claude Desktop.

Here's all you need to do:
1. Authenticate with Google Cloud (one-time setup)
2. Add your project details to Claude Desktop's config file
3. Start chatting with your BigQuery data naturally!

### What Can It Do? 📊

- Run SQL queries by just asking questions in plain English
- Access both tables and materialized views in your datasets
- Explore dataset schemas with clear labeling of resource types (tables vs views)
- Analyze data within safe limits (1GB query limit by default)
- Keep your data secure (read-only access)

## Quick Start 🚀

### Prerequisites
- Node.js 14 or higher
- Google Cloud project with BigQuery enabled
- Google Cloud CLI installed
- Claude Desktop (currently the only supported LLM interface)

### Setup in 3 Easy Steps

1. **Authenticate with Google Cloud**
   ```bash
   gcloud auth application-default login
   ```

2. **Add to your Claude Desktop config**
   Add this to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "bigquery": {
         "command": "npx",
         "args": [
           "-y",
           "@ergut/mcp-bigquery-server",
           "your-project-id",
           "location"  // Optional, defaults to us-central1
         ]
       }
     }
   }
   ```

3. **Start chatting!** 
   Open Claude Desktop and start asking questions about your data.

### Permissions Needed

You'll need one of these:
- `roles/bigquery.user` (recommended)
- OR both:
  - `roles/bigquery.dataViewer`
  - `roles/bigquery.jobUser`

## Developer Setup (Optional) 🔧

Want to customize or contribute? Here's how to set it up locally:

```bash
# Clone and install
git clone https://github.com/ergut/mcp-bigquery-server
cd mcp-bigquery-server
npm install

# Build
npm run build
```

Then update your Claude Desktop config to point to your local build:
```json
{
  "mcpServers": {
    "bigquery": {
      "command": "node",
      "args": [
        "/path/to/your/clone/mcp-bigquery-server/src/dist/index.js",
        "your-project-id",
        "location"  // Optional, defaults to us-central1
      ]
    }
  }
}
```

## Current Limitations ⚠️

- MCP support is currently only available in Claude Desktop (developer preview)
- Connections are limited to local MCP servers running on the same machine
- Queries are read-only with a 1GB processing limit
- While both tables and views are supported, some complex view types might have limitations

## Support & Resources 💬

- 🐛 [Report issues](https://github.com/ergut/mcp-bigquery-server/issues)
- 💡 [Feature requests](https://github.com/ergut/mcp-bigquery-server/issues)
- 📖 [Documentation](https://github.com/ergut/mcp-bigquery-server)

## License 📝

MIT License - See [LICENSE](LICENSE) file for details.

## Author ✍️ 

Salih Ergüt

## Version History 📋

See [CHANGELOG.md](CHANGELOG.md) for updates and version history.