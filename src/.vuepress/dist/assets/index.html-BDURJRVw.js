import{_ as e}from"./plugin-vue_export-helper-DlAUqK2U.js";import{c as t,o as a,a as n}from"./app-B3zAIQ7L.js";const o={},r=n('<h3 id="前言" tabindex="-1"><a class="header-anchor" href="#前言"><span>前言</span></a></h3><p>本篇文章主要介绍了 EasyDB 中两个关键模块的实现：索引管理器（Index Manager, IM）和全表扫描。索引管理器作为 EasyDB 的核心模块之一，负责管理 B+ 树索引，从而提高数据库的查询效率。而全表扫描则是当查询条件无法通过索引优化时，直接扫描整个表的实现方式。本文将通过具体代码示例，深入探讨这两个模块的实现细节与应用场景。</p><h4 id="索引管理器-im" tabindex="-1"><a class="header-anchor" href="#索引管理器-im"><span>索引管理器（IM）</span></a></h4><p>IM 是 EasyDB 中用于管理 B+ 树索引的模块，旨在通过高效的数据结构来加速数据库的查询操作。IM 直接基于数据管理器（DM）实现，意味着索引数据直接存储在数据库文件中，而无需经过版本管理。本文详细介绍了 B+ 树的节点结构、根节点的初始化、索引的插入与搜索操作，以及在节点操作中的错误处理与恢复机制。这些内容将帮助读者理解如何在数据库系统中实现高效的索引管理。</p><h4 id="全表扫描" tabindex="-1"><a class="header-anchor" href="#全表扫描"><span>全表扫描</span></a></h4><p>全表扫描是在查询条件无法通过索引优化时的一种查询策略。本文讨论了在以下两种情况下触发全表扫描：当 <code>where</code> 条件为空或查询的字段未建立索引时。通过对 Table 模块中的 <code>parseWhere</code> 方法进行解析，本文展示了如何判断是否需要进行全表扫描，以及如何在全表扫描过程中结合条件进行数据过滤。通过这些实现，EasyDB 能够在索引失效的情况下依然保证查询的完整性与正确性。</p><p>通过对索引管理与全表扫描的深入解析，本文为读者提供了有关数据库系统中索引优化与查询策略的重要知识，希望能为开发者在实际项目中实现高效的数据管理与查询提供帮助。</p>',7),i=[r];function c(p,s){return a(),t("div",null,i)}const m=e(o,[["render",c],["__file","index.html.vue"]]),h=JSON.parse('{"path":"/demo/index_manager/","title":"索引管理","lang":"zh-CN","frontmatter":{"title":"索引管理","index":false,"icon":"oui:app-index-pattern","category":["索引"],"tag":["index","fullIndex"],"description":"前言 本篇文章主要介绍了 EasyDB 中两个关键模块的实现：索引管理器（Index Manager, IM）和全表扫描。索引管理器作为 EasyDB 的核心模块之一，负责管理 B+ 树索引，从而提高数据库的查询效率。而全表扫描则是当查询条件无法通过索引优化时，直接扫描整个表的实现方式。本文将通过具体代码示例，深入探讨这两个模块的实现细节与应用场景。 ...","head":[["meta",{"property":"og:url","content":"https://github.com/blockCloth/EasyDB/demo/index_manager/"}],["meta",{"property":"og:site_name","content":"EasyDB"}],["meta",{"property":"og:title","content":"索引管理"}],["meta",{"property":"og:description","content":"前言 本篇文章主要介绍了 EasyDB 中两个关键模块的实现：索引管理器（Index Manager, IM）和全表扫描。索引管理器作为 EasyDB 的核心模块之一，负责管理 B+ 树索引，从而提高数据库的查询效率。而全表扫描则是当查询条件无法通过索引优化时，直接扫描整个表的实现方式。本文将通过具体代码示例，深入探讨这两个模块的实现细节与应用场景。 ..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2024-08-31T14:46:19.000Z"}],["meta",{"property":"article:author","content":"blockCloth"}],["meta",{"property":"article:tag","content":"index"}],["meta",{"property":"article:tag","content":"fullIndex"}],["meta",{"property":"article:modified_time","content":"2024-08-31T14:46:19.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"索引管理\\",\\"image\\":[\\"\\"],\\"dateModified\\":\\"2024-08-31T14:46:19.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"blockCloth\\",\\"url\\":\\"https://github.com/blockCloth\\"}]}"]]},"headers":[{"level":3,"title":"前言","slug":"前言","link":"#前言","children":[]}],"git":{"createdTime":1724854171000,"updatedTime":1725115579000,"contributors":[{"name":"Dai Yuxuan","email":"1808870333@qq.com","commits":2}]},"readingTime":{"minutes":1.81,"words":543},"filePathRelative":"demo/index_manager/README.md","localizedDate":"2024年8月28日","autoDesc":true,"excerpt":"<h3>前言</h3>\\n<p>本篇文章主要介绍了 EasyDB 中两个关键模块的实现：索引管理器（Index Manager, IM）和全表扫描。索引管理器作为 EasyDB 的核心模块之一，负责管理 B+ 树索引，从而提高数据库的查询效率。而全表扫描则是当查询条件无法通过索引优化时，直接扫描整个表的实现方式。本文将通过具体代码示例，深入探讨这两个模块的实现细节与应用场景。</p>\\n<h4>索引管理器（IM）</h4>\\n<p>IM 是 EasyDB 中用于管理 B+ 树索引的模块，旨在通过高效的数据结构来加速数据库的查询操作。IM 直接基于数据管理器（DM）实现，意味着索引数据直接存储在数据库文件中，而无需经过版本管理。本文详细介绍了 B+ 树的节点结构、根节点的初始化、索引的插入与搜索操作，以及在节点操作中的错误处理与恢复机制。这些内容将帮助读者理解如何在数据库系统中实现高效的索引管理。</p>"}');export{m as comp,h as data};
