# API 接口文档

## 基础信息

**Base URL**: `http://localhost:3000/api`

**响应格式**: JSON

**字符编码**: UTF-8

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 失败响应
```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息"
}
```

### 分页响应
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

## 1. 报表相关接口

### 1.1 获取报表字典列表

**接口**: `GET /api/reports/dictionary`

**描述**: 获取报表字典列表，支持多维度筛选和分页

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认20 |
| keyword | string | 否 | 搜索关键词 |
| module | string | 否 | 业务模块 |
| status | number | 否 | 报表状态：1-在用，0-已归档 |
| updateFrequency | string | 否 | 更新频率：实时/T+1/周/月 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "终端数据面板",
      "iconId": "icon_001",
      "path": "/reports/terminal-data",
      "description": "核心销售数据驾驶舱",
      "module": "临床经验",
      "ownerName": "张三",
      "updateFrequency": "实时",
      "totalViews": 1250,
      "coreMetrics": ["终端销售", "数据质量"],
      "status": 1
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### 1.2 获取报表详情

**接口**: `GET /api/reports/:id`

**描述**: 根据报表ID获取详细信息

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 报表ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "终端数据面板",
    "description": "核心销售数据驾驶舱",
    "module": "临床经验",
    "ownerName": "张三",
    "ownerDept": "销售部",
    "devOwnerName": "李四",
    "devOwnerDept": "IT部",
    "sourceSystem": "SAP,CRM",
    "coreMetrics": ["终端销售", "数据质量", "商业库存"],
    "calcLogic": "计算逻辑说明...",
    "updateFrequency": "实时",
    "status": 1,
    "onlineDate": "2024-01-01",
    "lastUpdatedAt": "2024-10-20",
    "totalViews": 1250
  }
}
```

### 1.3 增加报表访问次数

**接口**: `POST /api/reports/:id/view`

**描述**: 记录用户访问报表，增加访问计数

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 报表ID |

**响应示例**:
```json
{
  "success": true,
  "message": "访问次数已更新"
}
```

## 2. 工作台相关接口

### 2.1 获取最近打开

**接口**: `GET /api/workbench/recent`

**描述**: 获取用户最近打开的报表列表

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认20 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "集团经营分析总览驾驶舱",
      "type": "dashboard",
      "iconId": "icon_001",
      "module": "财务管理",
      "lastOpenTime": "2024-10-21",
      "visitCount": 15
    }
  ]
}
```

### 2.2 获取常用报表

**接口**: `GET /api/workbench/frequent`

**描述**: 获取用户常用报表（访问次数>=3）

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认20 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "2",
      "name": "财务共享中心月度报表",
      "type": "report",
      "iconId": "icon_002",
      "module": "财务管理",
      "visitCount": 25,
      "lastOpenTime": "2024-10-20"
    }
  ]
}
```

### 2.3 获取收藏报表

**接口**: `GET /api/workbench/favorite`

**描述**: 获取用户收藏的报表列表

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |

**响应示例**:
```json
{
  "success": true,
  "data": [],
  "message": "需要对接帆软平台收藏接口"
}
```

## 3. 公告相关接口

### 3.1 获取公告列表

**接口**: `GET /api/notices`

**描述**: 获取制度公告列表

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认10 |
| isTop | string | 否 | 是否置顶：1-是，0-否 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-001",
      "title": "云南白药集团数据门户管理办法（试行）",
      "category": "管理办法",
      "isTop": "1",
      "startDate": "2024-09-01",
      "expiryDate": "2025-12-31",
      "content": "公告内容...",
      "hasHyperlink": "0",
      "hyperlink": null,
      "registeredBy": "admin",
      "registerDate": "2024-09-01"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50
  }
}
```

### 3.2 获取公告详情

**接口**: `GET /api/notices/:id`

**描述**: 根据公告ID获取详细信息

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 公告UUID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-001",
    "title": "云南白药集团数据门户管理办法（试行）",
    "category": "管理办法",
    "isTop": "1",
    "content": "详细公告内容...",
    "startDate": "2024-09-01",
    "expiryDate": "2025-12-31",
    "hasHyperlink": "1",
    "hyperlink": "http://example.com/doc.pdf",
    "regionIds": "1,2,3",
    "regionDesc": "财务部,销售部,IT部"
  }
}
```

## 4. 快捷入口相关接口

### 4.1 获取快捷入口列表

**接口**: `GET /api/quick-entries`

**描述**: 获取所有启用的快捷入口

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "问题反馈",
      "description": "使用问题反馈入口",
      "url": "http://feedback.example.com",
      "iconUrl": "/assets/icons/feedback.png",
      "sortNo": 1,
      "status": 1
    }
  ]
}
```

### 4.2 获取快捷入口详情

**接口**: `GET /api/quick-entries/:id`

**描述**: 根据ID获取快捷入口详情

**路径参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 快捷入口ID |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "问题反馈",
    "description": "使用问题反馈入口",
    "url": "http://feedback.example.com",
    "iconUrl": "/assets/icons/feedback.png",
    "sortNo": 1,
    "status": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-10-01T00:00:00Z"
  }
}
```

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 注意事项

1. 所有接口均需通过帆软平台的身份认证
2. 接口响应时间目标：< 500ms
3. 数据库查询使用索引优化性能
4. 大数据量查询建议使用分页
5. 建议前端做好错误处理和重试机制
