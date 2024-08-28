import { defineUserConfig } from "vuepress";

import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "EasyDB",
  description: "EasyDB教程文档",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
