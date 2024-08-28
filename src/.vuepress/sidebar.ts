import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "" ,
    {
      text: "EasyDB使用文档",
      icon: "laptop-code",
      prefix: "document/",
      link: "document/",
      children: "structure",
    },
    {
      text: "EasyDB教程文档",
      icon: "laptop-code",
      prefix: "demo/",
      link: "demo/",
      children: [
        {
          text: "事务管理",
          prefix: "transaction_manager/",
          link: "transaction_manager/",
          children: "structure",
        
        },
        {
          text: "数据管理",
          prefix: "data_manager/",
          link: "data_manager/",
          children: "structure"
        },
        {
          text: "版本管理",
          prefix: "version_manager/",
          link: "version_manager/",
          children: "structure"
        },
        {
          text: "索引管理",
          prefix: "index_manager/",
          link: "index_manager/",
          children: "structure"
        },
        {
          text: "字段与表管理",
          prefix: "tbm_manager/",
          link: "tbm_manager/",
          children: "structure"
        },
      ]
    }
  ],
});
