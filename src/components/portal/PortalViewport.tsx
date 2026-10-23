"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, ChevronUp, Monitor } from 'lucide-react';

const modes = [
  { id: 'current', label: '当前布局', description: '保留桌面断点布局和模块固定高度' },
  { id: 'width', label: '宽度自适应', description: '按窗口宽度等比例缩放，允许纵向滚动' },
  { id: 'fit', label: '双向自适应', description: '横纵独立拉伸，铺满当前窗口' },
] as const;
type DisplayMode = typeof modes[number]['id'];
const storageKey = 'ynby.portal.display-mode';
const designWidth = 1920;
const DisplayContext = createContext<{ mode: DisplayMode; choose: (mode: DisplayMode) => void } | null>(null);

export default function PortalViewport({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DisplayMode>('current');
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const transition = useRef<ViewTransition | null>(null);
  const [size, setSize] = useState({ width: designWidth, height: 1080, contentHeight: 1080 });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (modes.some(item => item.id === saved)) setMode(saved as DisplayMode);
    } catch { /* Embedded browsers may disable storage; the current page still works. */ }
  }, []);
  useLayoutEffect(() => {
    if (mode === 'current') return;
    const container = viewport.current!, content = canvas.current!;
    function measure() {
      const next = { width: container.clientWidth, height: window.innerHeight, contentHeight: parseFloat(getComputedStyle(content).height) };
      setSize(previous => previous.width === next.width && previous.height === next.height && previous.contentHeight === next.contentHeight ? previous : next);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(container); observer.observe(content);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [mode]);
  function choose(next: DisplayMode) {
    if (next === mode && !transition.current) return;
    transition.current?.skipTransition();
    const update = () => { flushSync(() => setMode(next)); window.scrollTo(0, 0); };
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const active = document.startViewTransition(update);
      transition.current = active;
      void active.ready.catch(() => { /* A newer selection may skip this animation. */ });
      void active.finished.then(() => { if (transition.current === active) transition.current = null; });
    } else update();
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the selection for this page. */ }
  }
  const scaled = mode !== 'current';
  const scaleX = size.width / designWidth;
  const scaleY = mode === 'fit' ? size.height / Math.max(1, size.contentHeight) : scaleX;
  return <DisplayContext.Provider value={{ mode, choose }}>
    <div ref={viewport} className="portal-viewport" data-display-mode={mode}>
      <div className={`portal-frame${scaled ? ' is-scaled' : ''}`} style={scaled ? { width: designWidth * scaleX, height: size.contentHeight * scaleY } : undefined}>
        <div ref={canvas} className="portal-canvas" style={scaled ? { width: designWidth, transform: `scale(${scaleX}, ${scaleY})` } : undefined}>{children}</div>
      </div>
    </div>
  </DisplayContext.Provider>;
}

export function DisplayModeSwitch() {
  const context = useContext(DisplayContext)!;
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem('ynby.portal.modes-collapsed') === 'true'); } catch { /* Session preference only. */ } }, []);
  function toggle() { setCollapsed(value => { try { localStorage.setItem('ynby.portal.modes-collapsed', String(!value)); } catch { /* Session preference only. */ } return !value; }); }
  return <div className="display-controls" data-coach="display"><button className="display-collapse" aria-label={collapsed ? '展开显示模式' : '收起显示模式'} aria-expanded={!collapsed} aria-controls="display-mode-options" onClick={toggle}><Monitor size={14} />{collapsed ? modes.find(m => m.id === context.mode)?.label : '显示模式'}{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
    <div id="display-mode-options" className="display-mode-switch" role="group" aria-label="显示模式" hidden={collapsed}>
    {modes.map(item => <button key={item.id} type="button" title={item.description} aria-pressed={context.mode === item.id} onClick={() => context.choose(item.id)}>{item.label}</button>)}
  </div></div>;
}
