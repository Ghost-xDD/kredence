import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Kredence",
  description:
    "Autonomous impact intelligence. No forms. No summaries. Just evidence.",
  lang: "en-US",

  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#16a34a" }],
    ["meta", { property: "og:title", content: "Kredence Docs" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Autonomous impact intelligence. No forms. No summaries. Just evidence.",
      },
    ],
  ],

  themeConfig: {
    logo: { src: "/logo.svg", alt: "Kredence" },
    siteTitle: "Kredence",

    nav: [
      { text: "Guide", link: "/introduction/what-is-kredence" },
      { text: "SDK", link: "/sdk/installation" },
      { text: "API Reference", link: "/api-reference/rest" },
      {
        text: "v0.1.3",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/Ghost-xDD/credence/releases",
          },
          {
            text: "npm",
            link: "https://npmjs.com/package/kredence",
          },
        ],
      },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is Kredence?", link: "/introduction/what-is-kredence" },
          { text: "How it works", link: "/introduction/how-it-works" },
          { text: "Quickstart", link: "/introduction/quickstart" },
        ],
      },
      {
        text: "SDK",
        items: [
          { text: "Installation", link: "/sdk/installation" },
          { text: "KredenceClient", link: "/sdk/client" },
          { text: "PipelineRun", link: "/sdk/pipeline-run" },
          { text: "Types", link: "/sdk/types" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "REST endpoints", link: "/api-reference/rest" },
          { text: "WebSocket protocol", link: "/api-reference/websocket" },
        ],
      },
      {
        text: "Ecosystem Inputs",
        items: [
          { text: "GitHub Repo", link: "/ecosystem-inputs/github-repo" },
          { text: "Gitcoin", link: "/ecosystem-inputs/gitcoin" },
          { text: "Devspot", link: "/ecosystem-inputs/devspot" },
          {
            text: "Filecoin Dev Grants",
            link: "/ecosystem-inputs/filecoin-devgrants",
          },
          { text: "Octant", link: "/ecosystem-inputs/octant" },
          { text: "Devfolio", link: "/ecosystem-inputs/devfolio" },
          { text: "Manual URL list", link: "/ecosystem-inputs/manual" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Embed a badge", link: "/guides/badge" },
          {
            text: "Build a portfolio dashboard",
            link: "/guides/portfolio-dashboard",
          },
          { text: "Stream a live pipeline", link: "/guides/stream-pipeline" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/Ghost-xDD/credence" },
      {
        icon: { svg: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v24h24V0H0zm13.079 5.313l2.803 2.803-1.599 1.599L12 7.508l-2.283 2.207L8.118 8.116l2.803-2.803h2.158zm-5.87 5.13l1.6 1.599-1.6 1.599L5.61 12l1.599-1.599V11.443zm9.582 0l1.599 1.599L16.39 12l-1.599-1.599v-.042l1.599 1.641zm-4.791 2.756l2.283 2.207-1.599 1.599-2.803-2.803v-2.158l1.599 1.599.52-.444z"/></svg>' },
        link: "https://npmjs.com/package/kredence",
      },
    ],

    editLink: {
      pattern:
        "https://github.com/Ghost-xDD/credence/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025 Kredence",
    },

    search: {
      provider: "local",
    },
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
});
