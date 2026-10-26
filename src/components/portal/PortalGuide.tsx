"use client";
import { useEffect, useState } from 'react';
import { Tour } from 'antd';
import { CircleHelp } from 'lucide-react';

const seenKey = 'ynby.portal.guide.v1';
let dismissedInSession = false;
export default function PortalGuide({ dictionary }: { dictionary: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  useEffect(() => { try { if (!dismissedInSession && localStorage.getItem(seenKey) !== 'done') setOpen(true); } catch { /* Help remains available when storage is blocked. */ } }, []);
  function close() { setOpen(false); dismissedInSession = true; try { localStorage.setItem(seenKey, 'done'); } catch { /* This page can still dismiss the guide. */ } }
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [open]);
  const steps = [
    ['.portal-search', '从搜索开始', '点击搜索框查看最近打开的报表。切换报表、标签或指标，输入关键词即可查找；确认搜索后保存到你的搜索记录。'],
    ...(dictionary ? [
      ['.filters', '组合筛选报表', '按业务模块、状态、数据时效和累计访问量筛选，结果仅包含你有权限查看的报表。'],
      ['.dictionary-panel', '查看口径与打开报表', '查看详情了解负责人、数据来源和指标口径，也可以收藏或直接在平台打开。'],
    ] : [
      ['.workbench .segmented', '切换你的工作台', '最近打开、我常用的和我收藏的使用页面缓存，切换无需等待。列表每 10 分钟静默更新。'],
      ['.thematic', '逐级探索专题', '切换事业群或进入专题文件夹，查看当前账号有权限访问的目录和报表。'],
      ['.dictionary-link', '了解每份报表', '进入报表字典，查看报表说明、负责人、数据来源和指标口径。'],
    ]),
    ['[data-coach="display"]', '选择适合窗口的模式', '宽度自适应保持设计稿比例；双向自适应按窗口高度分配面板空间，更多内容在面板内滚动。文字和图标保持比例，模式切换可收起。'],
  ];
  return <><button className="guide-trigger" onClick={() => { setCurrent(0); setOpen(true); }}><CircleHelp size={14} />使用引导</button>
    <Tour open={open} current={current} onChange={setCurrent} onClose={close} onFinish={close} scrollIntoViewOptions={false} steps={steps.map(([selector, title, description], index) => ({ title, description, target: open ? document.querySelector<HTMLElement>(selector) : null, nextButtonProps: { children: index === steps.length - 1 ? '完成' : '下一步' }, prevButtonProps: { children: '上一步' } }))} actionsRender={actions => <><button className="text-button guide-skip" onClick={close}>跳过引导</button>{actions}</>} />
  </>;
}
