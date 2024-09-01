import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "" ,
    {
      text: "EasyDB使用文档",
      icon: "laptop-code",
      prefix: "document/",
      link: "document/",
      collapsible: true, // 添加这个选项使其可折叠
      children: "structure",
    },
    {
      text: "EasyDB教程文档",
      icon: "laptop-code",
      prefix: "demo/",
      link: "demo/",
      collapsible: true, // 添加这个选项使其可折叠
      children: [
        // {
        //   text: "前言",
        //   prefix: "preface/",
        //   link: "preface/",
        //   children: "structure",
        // },
        {
          text: "事务管理",
          prefix: "transaction_manager/",
          link: "transaction_manager/",
          children: "structure",
          collapsible: true, // 添加这个选项使其可折叠
        },
        {
          text: "数据管理",
          prefix: "data_manager/",
          link: "data_manager/",
          collapsible: true, // 添加这个选项使其可折叠
          children: "structure"
          
        },
        {
          text: "版本管理",
          prefix: "version_manager/",
          link: "version_manager/",
          collapsible: true, // 添加这个选项使其可折叠
          children: "structure"
        },
        {
          text: "索引管理",
          prefix: "index_manager/",
          link: "index_manager/",
          collapsible: true, // 添加这个选项使其可折叠
          children: "structure"
        },
        {
          text: "字段与表管理",
          prefix: "tbm_manager/",
          link: "tbm_manager/",
          collapsible: true, // 添加这个选项使其可折叠
          children: "structure"
        },
        {
          text: "通信协议",
          prefix: "communication_manager/",
          link: "communication_manager/",
          collapsible: true, // 添加这个选项使其可折叠
          children: "structure"
        },
      ]
    }
  ],
});
