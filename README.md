# BigQuery MCP Server
<div align="center">
  <img src="assets/mcp-bigquery-server-logo.png" alt="BigQuery MCP Server Logo" width="400"/>
</div>

[Model Context Protocol](https://modelcontextprotocol.io/introduction) (MCP) is a standardized protocol that enables secure and efficient communication between large language models (LLMs) and external systems. This repository provides an MCP server that allows LLMs to safely interact with [BigQuery](https://cloud.google.com/bigquery/) datasets, enabling controlled data analysis while maintaining security.

## What Does This Server Do?

The server provides read-only access to BigQuery datasets through the MCP standard, allowing LLMs to:
- Execute safe, read-only SQL queries
- Inspect dataset schemas
- Analyze data within defined safety limits

### Tools

- **query**
  - Execute read-only SQL queries against BigQuery
  - Input: `sql` (string): The SQL query to execute
  - Safety limits: 1GB maximum bytes billed per query

### Resources

The server provides schema information for each table:

- **Table Schemas** (`bigquery://<project-id>/<dataset>/<table>/schema`)
  - JSON schema information for each table
  - Includes column names and data types
  - Automatically discovered from dataset metadata

## Getting Started
Before you begin, make sure you have:
1. Node.js version 14 or higher installed
2. A Google Cloud project with BigQuery enabled
3. Google Cloud CLI installed
4. Basic familiarity with BigQuery and SQL queries

This server can be used in two ways:
1. Via NPX for quick setup with Claude Desktop
2. Local development for customization and development


### Via NPX
Add the following to your `claude_desktop_config.json`:

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

### Local Development
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
Note: If any dependency fails during installation, you can remove it from the root `package.json` and proceed with the installation.

3. Build the project:
```bash
npm run build
```

4. Configure Claude Desktop for local development. Add to your `claude_desktop_config.json`:
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

## Authentication

The server uses Google Cloud authentication. Ensure you have:
1. Installed Google Cloud CLI
2. Run `gcloud auth application-default login`
3. Required IAM Roles:
   - Option 1: `roles/bigquery.user` (recommended)
   - Option 2: Both of these roles:
     - `roles/bigquery.dataViewer` - Grants read access to tables
     - `roles/bigquery.jobUser` - Allows query execution
   
   Note: Contact your GCP administrator to get the necessary roles assigned to your account.

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.

## Support 💬

- 🐛 [Report issues](https://github.com/ergut/mcp-bigquery-server/issues)
- 💡 [Feature requests](https://github.com/ergut/mcp-bigquery-server/issues)
- 📖 [Documentation](https://github.com/ergut/mcp-bigquery-server)

## Author ✍️ 

Salih Ergüt

## Version 📋

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.