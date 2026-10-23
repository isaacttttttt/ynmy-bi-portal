"use client";

import { useEffect } from "react";
import { initRemAdapter } from "@/lib/rem";

/**
 * REM 适配初始化组件
 * 放在 layout.tsx 中使用
 */
export default function RemAdapter() {
  useEffect(() => {
    initRemAdapter();
  }, []);

  return null;
}
