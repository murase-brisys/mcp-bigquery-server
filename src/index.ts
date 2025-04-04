#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BigQuery } from '@google-cloud/bigquery';

import { promises as fs } from 'fs';

// Define configuration interface
interface ServerConfig {
  projectId: string;
  location?: string;
  keyFilename?: string;
}

async function validateConfig(config: ServerConfig): Promise<void> {
  // Check if key file exists and is readable
  if (config.keyFilename) {
    try {
      await fs.access(config.keyFilename, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Service account key file not accessible: ${config.keyFilename}`);
    }

    // Validate file contents
    try {
      const keyFileContent = await fs.readFile(config.keyFilename, 'utf-8');
      const keyData = JSON.parse(keyFileContent);
      
      // Basic validation of key file structure
      if (!keyData.type || keyData.type !== 'service_account' || !keyData.project_id) {
        throw new Error('Invalid service account key file format');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Service account key file is not valid JSON');
      }
      throw error;
    }
  }

  // Validate project ID format (basic check)
  if (!/^[a-z0-9-]+$/.test(config.projectId)) {
    throw new Error('Invalid project ID format');
  }

  // Validate location if provided
  if (config.location && !/^[a-z]+-[a-z]+\d+$/.test(config.location)) {
    throw new Error('Invalid location format');
  }
}

function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    projectId: '',
    location: 'us-central1' // Default location
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Invalid argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error(`Missing value for argument: ${arg}`);
    }

    const value = args[++i];
    
    switch (key) {
      case 'project-id':
        config.projectId = value;
        break;
      case 'location':
        config.location = value;
        break;
      case 'key-file':
        config.keyFilename = value;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!config.projectId) {
    throw new Error(
      "Missing required argument: --project-id\n" +
      "Usage: mcp-server-bigquery --project-id <project-id> [--location <location>] [--key-file <path-to-key-file>]"
    );
  }

  return config;
}

const server = new Server(
  {
    name: "mcp-server/bigquery",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {}
    },
  },
);

const config = parseArgs();
console.error(`Initializing BigQuery with project ID: ${config.projectId} and location: ${config.location}`);

const bigqueryConfig: {
  projectId: string;
  keyFilename?: string;
} = {
  projectId: config.projectId
};

if (config.keyFilename) {
  console.error(`Using service account key file: ${config.keyFilename}`);
  bigqueryConfig.keyFilename = config.keyFilename;
}

const bigquery = new BigQuery(bigqueryConfig);

const resourceBaseUrl = new URL(`bigquery://${config.projectId}`);

const SCHEMA_PATH = "schema";

function qualifyTablePath(sql: string, projectId: string): string {
  // Match FROM INFORMATION_SCHEMA.TABLES or FROM dataset.INFORMATION_SCHEMA.TABLES
  const unqualifiedPattern = /FROM\s+(?:(\w+)\.)?INFORMATION_SCHEMA\.TABLES/gi;
  return sql.replace(unqualifiedPattern, (match, dataset) => {
    if (dataset) {
      return `FROM \`${projectId}.${dataset}.INFORMATION_SCHEMA.TABLES\``;
    }
    throw new Error("Dataset must be specified when querying INFORMATION_SCHEMA (e.g. dataset.INFORMATION_SCHEMA.TABLES)");
  });
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    console.error('Fetching datasets...');
    const [datasets] = await bigquery.getDatasets();
    console.error(`Found ${datasets.length} datasets`);
    
    const resources = [];

    for (const dataset of datasets) {
      console.error(`Processing dataset: ${dataset.id}`);

      const [tables] = await dataset.getTables();
      console.error(`Found ${tables.length} tables and views in dataset ${dataset.id}`);
      
      // リソース名をより明確にする
      resources.push({
        uri: new URL(`${dataset.id}/${SCHEMA_PATH}`, resourceBaseUrl).href,
        mimeType: "application/json",
        name: `Dataset: ${dataset.id} (${tables.length} tables/views)`,
        // メタデータを追加して明示的にデータセット情報を含める
        metadata: {
          datasetId: dataset.id,
          projectId: config.projectId,
          resourceType: "dataset"
        }
      });
    }

    console.error(`Total resources found: ${resources.length}`);
    return { resources };
  } catch (error) {
    console.error('Error in ListResourcesRequestSchema:', error);
    throw error;
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const schema = pathComponents.pop();
  const datasetId = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  // データセット内のすべてのテーブル情報を取得
  const dataset = bigquery.dataset(datasetId!);
  const [tables] = await dataset.getTables();
  
  // 各テーブルの情報を収集
  const tablesInfo = await Promise.all(
    tables.map(async (table) => {
      const [metadata] = await table.getMetadata();
      return {
        // テーブル情報をより明確に
        datasetId: datasetId,
        tableId: table.id,
        fullTableId: `${config.projectId}.${datasetId}.${table.id}`, // 完全修飾名を追加
        type: metadata.type,
        schema: metadata.schema.fields,
        // サンプルSQLクエリを追加
        sampleQuery: `SELECT * FROM \`${config.projectId}.${datasetId}.${table.id}\` LIMIT 10`
      };
    })
  );

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(tablesInfo, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only BigQuery SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
            maximumBytesBilled: { 
              type: "string",
              description: "Maximum bytes billed (default: 1GB)",
              optional: true
            },
            datasetId: {
              type: "string",
              description: "Dataset ID to use if not specified in query",
              optional: true
            }
          },
        },
      },
      // テーブル一覧を取得するツールを追加
      {
        name: "listTables",
        description: "List all tables in a specific dataset",
        inputSchema: {
          type: "object",
          properties: {
            datasetId: { type: "string" }
          },
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query") {
    let sql = request.params.arguments?.sql as string;
    let maximumBytesBilled = request.params.arguments?.maximumBytesBilled || "1000000000";
    const datasetId = request.params.arguments?.datasetId;
    
    // Validate read-only query
    const forbiddenPattern = /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|MERGE|TRUNCATE|GRANT|REVOKE|EXECUTE|BEGIN|COMMIT|ROLLBACK)\b/i;
    if (forbiddenPattern.test(sql)) {
      throw new Error('Only READ operations are allowed');
    }    

    try {
      // データセットIDが提供され、SQLにFROM句がある場合、修飾されていないテーブル名を完全修飾
      if (datasetId) {
        const tablePattern = /FROM\s+`?([^`.\s]+)`?(?!\.[^.\s])/gi;
        sql = sql.replace(tablePattern, (match, tableName) => {
          return `FROM \`${config.projectId}.${datasetId}.${tableName}\``;
        });
      }

      // Qualify INFORMATION_SCHEMA queries
      if (sql.toUpperCase().includes('INFORMATION_SCHEMA')) {
        sql = qualifyTablePath(sql, config.projectId);
      }

      const [rows] = await bigquery.query({
        query: sql,
        location: config.location,
        maximumBytesBilled: maximumBytesBilled.toString(),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        isError: false,
      };
    } catch (error) {
      throw error;
    }
  } else if (request.params.name === "listTables") {
    const datasetId = request.params.arguments?.datasetId;
    if (!datasetId) {
      throw new Error("datasetId is required");
    }

    try {
      const dataset = bigquery.dataset(datasetId as string);
      const [tables] = await dataset.getTables();
      
      const tablesList = tables.map(table => ({
        tableId: table.id,
        fullTableId: `${config.projectId}.${datasetId}.${table.id}`
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(tablesList, null, 2) }],
        isError: false,
      };
    } catch (error) {
      throw error;
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer() {
  try {
    const config = parseArgs();
    await validateConfig(config);
    
    console.error(`Initializing BigQuery with project ID: ${config.projectId} and location: ${config.location}`);
    if (config.keyFilename) {
      console.error(`Using service account key file: ${config.keyFilename}`);
    }

    const bigquery = new BigQuery({
      projectId: config.projectId,
      keyFilename: config.keyFilename
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error('An unknown error occurred:', error);
    }
    process.exit(1);
  }
}

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [{
      name: "gitlab-report",
      description: "GitLabのマイルストーンに関するレポートを生成します。",
      arguments: [{
        name: "milestone",
        description: "マイルストーン",
        required: true
      }]
    }]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "gitlab-report") {
    throw new Error("Unknown prompt");
  }
  return {
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `
# GitLabの開発状況の可視化

## 目的
BigQueryからGitLabのデータからマイルストーン"3.11.0"についてチームごとに振り返りのデータを作成します。
上記をそれぞれグラフにまとめ、日本人の向けたレポートを作成します。
グラフはプレゼンでプロが利用するようなモダンなデザインを目指します。
最後にこのデータからプロジェクトマネージメントの観点から所感と、仮説を提案してください。

## 抽出対象
 - コミット数の合計
   - merge_request_commitsの数を集計
 - マージリクエストの合計数
 - マージリクエストの合計数のstate別の合計数
 - マージされたマージリクエストのリードタイムの平均
 - 現在オープンされているMRを作成日が最も古い順から最大5個を抽出
   - weburi必須

## グラフ化
 - コミット数の合計
   - チーム別に棒グラフ
 - マージリクエストの合計数
   - チーム別に棒グラフ
 - マージリクエストの合計数のstate別の合計数
   - チーム別にstateで分類した積み上げ棒グラフ
 - マージされたマージリクエストのリードタイムの平均
   - チーム別に棒グラフ
 - 現在オープンされているMRを作成日が最も古い順から最大5個を抽出
   - table形式
	 - weburiを記載
				`
      }
    }]
  };
});

runServer().catch(console.error);