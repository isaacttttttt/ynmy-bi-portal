"use client";

import { motion } from "framer-motion";
import { mockQuickEntryData } from "@/lib/mockData";

export default function QuickEntrySection() {
  return (
    <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-gray-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
          <h2 className="text-lg font-bold text-gray-800">快捷入口</h2>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        {mockQuickEntryData.map((entry, index) => (
          <motion.a
            key={entry.id}
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
            whileHover={{ scale: 1.01 }}
            className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border border-transparent hover:border-blue-100 hover:bg-blue-50 group"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500/10 to-blue-400/5 rounded-lg flex items-center justify-center group-hover:from-blue-500/20 group-hover:to-blue-400/10 transition-all">
              <span className="text-2xl">{entry.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                {entry.name}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {entry.description}
              </p>
            </div>
            <div className="flex-shrink-0 text-gray-400 group-hover:text-blue-500 transition-colors">
              →
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}
