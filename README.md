# ChatPPC

[![Build and Test](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/StanfordBDHG/ChatPPC/actions/workflows/build-and-test.yml) 
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/chatppc)

![ChatPPC Screenshot](public/images/ChatPPC-screenshot-light.png#gh-light-mode-only)
![ChatPPC Screenshot](public/images/ChatPPC-screenshot-dark.png#gh-dark-mode-only)

ChatPPC is a tool to help staff at [Gardner Packard Children's Health Center](https://med.stanford.edu/ppc.html) navigate patient care resources.

## Features

### 🔍 **Intelligent Document Search**
- AI-powered chat interface for navigating Stanford PPC documentation
- Retrieval-augmented generation (RAG) using OpenAI GPT-4o-mini
- Semantic search through uploaded medical resource documents
- Source attribution with automatic link generation to relevant documents

### 💬 **Advanced Chat Capabilities**
- Real-time streaming responses for immediate feedback
- Persistent chat sessions with conversation history
- Context-aware responses that maintain conversation continuity
- Safety features with PHI (Protected Health Information) warnings

### 📚 **Document Management**
- Batch document ingestion via command-line script
- Automatic text processing and embedding generation
- Vector database storage for fast semantic retrieval

### 🎨 **Modern User Interface**
- Responsive design optimized for desktop and mobile
- Dark/light theme support
- Clean, accessible interface built with Tailwind CSS and Radix UI

## Quick Start

To set up the project for local development, see [DEVELOPMENT.md](./DEVELOPMENT.md).

To add documents for AI retrieval, see [INGESTION.md](./INGESTION.md).

To deploy the project to production, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Contributing

Contributions to this project are welcome.