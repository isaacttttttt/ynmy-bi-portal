"use client";

import { useState } from "react";
import { Modal } from "antd";
import { motion } from "framer-motion";
import { mockNoticeData } from "@/lib/mockData";
import { CloseOutlined } from "@ant-design/icons";

export default function NoticeSection() {
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNoticeClick = (notice: any) => {
    setSelectedNotice(notice);
    setIsModalOpen(true);
  };

  return (
    <>
      <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-lg font-bold text-gray-800">制度公告</h2>
          </div>
          <button className="text-blue-500 text-sm hover:text-blue-600 transition-colors">
            更多 →
          </button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
          {mockNoticeData.map((notice, index) => (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ backgroundColor: "rgba(59, 130, 246, 0.05)" }}
              onClick={() => handleNoticeClick(notice)}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border border-transparent hover:border-blue-100"
            >
              <div className="flex-shrink-0 w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-800 truncate flex-1">
                    {notice.title}
                  </h3>
                  {notice.isTop && (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                      置顶
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-1 truncate">
                  {notice.category}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate">{notice.source}</span>
                  <span className="flex-shrink-0 ml-2">{notice.date}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 公告弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {selectedNotice?.isTop && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                置顶
              </span>
            )}
            <span className="text-lg font-semibold">{selectedNotice?.title}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={700}
        centered
        closeIcon={<CloseOutlined />}
        className="notice-modal"
      >
        <div className="py-4">
          {/* 公告元信息 */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
            <span className="flex items-center gap-2">
              <span className="font-medium">分类：</span>
              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                {selectedNotice?.category}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium">来源：</span>
              {selectedNotice?.source}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium">发布日期：</span>
              {selectedNotice?.date}
            </span>
          </div>

          {/* 公告内容 */}
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {selectedNotice?.content ||
                `尊敬的各位同事：\n\n为规范集团数据门户的使用和管理，确保数据安全和信息准确性，现发布《${selectedNotice?.title}》。\n\n主要内容包括：\n1. 数据门户的使用规范和权限管理\n2. 报表开发和发布流程\n3. 数据安全和保密要求\n4. 问题反馈和技术支持渠道\n\n请各位同事认真学习并严格遵守相关规定。\n\n特此通知。\n\n集团信息技术部\n${selectedNotice?.date}`
              }
            </p>
          </div>

          {/* 附件链接 */}
          {selectedNotice?.url && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <a
                href={selectedNotice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span>📎</span>
                <span>查看完整文件</span>
              </a>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
