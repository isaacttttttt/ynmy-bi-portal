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
    ['.portal-search', '快速搜索报表', '点击搜索框即可查看最近看过的报表；也可切换「综合、报表、指标、标签」输入关键词查找，搜过的词会自动保存，方便下次直接点选。'],
    ...(dictionary ? [
      ['.filters', '按条件筛选报表', '勾选左侧的所属组织、报表状态、权限状态、数据时效或访问量级，就能快速缩小范围，精准找到目标报表。'],
      ['.dictionary-panel', '看口径、直接打开报表', '点击「查看详情」可了解报表用途、指标口径、数据来源和负责人；有访问权限的报表点右下角即可直接打开，常用的还能点星标收藏。'],
    ] : [
      ['.workbench .segmented', '切换我的工作台', '在这里可以快速切换「最近打开」「我常用的」和「我收藏的」，点击卡片即可直接打开报表，不用再到处翻找。'],
      ['.thematic', '按业务专题找报表', '点击卡片即可逐层进入对应专题并打开报表；如拥有多个岗位角色，可点击右上角下拉框切换查看，进入目录后也可通过上方路径随时返回上一级。'],
      ['.dictionary-link', '查看报表字典', '想了解某张报表怎么看、指标怎么算或找谁对接？点击这里进入报表字典，可查看完整说明、指标口径、数据来源和负责人。'],
    ]),
  ];
  return <><button className="guide-trigger" onClick={() => { setCurrent(0); setOpen(true); }}><CircleHelp size={14} />使用引导</button>
    <Tour open={open} current={current} onChange={setCurrent} onClose={close} onFinish={close} scrollIntoViewOptions={false} steps={steps.map(([selector, title, description], index) => ({ title, description, target: open ? document.querySelector<HTMLElement>(selector) : null, nextButtonProps: { children: index === steps.length - 1 ? '完成' : '下一步' }, prevButtonProps: { children: '上一步' } }))} actionsRender={actions => <><button className="text-button guide-skip" onClick={close}>跳过引导</button>{actions}</>} />
  </>;
}
