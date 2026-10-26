// Real browser regression for design proportions, fit layouts and modal stability.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
  const base=process.env.PORTAL_URL || 'http://localhost:3000', live=process.env.PORTAL_LIVE_POC==='1';
  const browser=await chromium.launch({headless:true,channel:'msedge',ignoreDefaultArgs:['--hide-scrollbars']});
  const context=await browser.newContext({viewport:{width:1920,height:1080}});
  await context.addInitScript(()=>{
    localStorage.setItem('ynby.portal.guide.v1','done');
    window.modeTransitions=[];
    const start=document.startViewTransition.bind(document);
    document.startViewTransition=update=>{const transition=start(update);window.modeTransitions.push(transition);return transition;};
  });
  const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  try {
    if(live){const {accessKey}=JSON.parse(await fs.readFile('artifacts/qa/railway-secrets.json','utf8'));const response=await context.request.post(base+'/poc/login',{headers:{Origin:base},data:{user:'admin',accessKey}});assert.equal(response.status(),200);}
    await page.goto(base+'/');await page.setContent(`<iframe name="portal" src="${base}/" style="width:100%;height:100vh;border:0;display:block"></iframe><style>body{margin:0}</style>`);
    const frame=page.frame({name:'portal'});await frame.locator('.notice-row').first().waitFor();
    const settle=()=>frame.evaluate(()=>Promise.all(window.modeTransitions.map(t=>t.finished)));
    const read=()=>frame.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {main:rect('.home-layout'),background:rect('.portal-viewport'),notices:document.querySelector('.notices .notice-list').innerText,scale:getComputedStyle(document.querySelector('.portal-canvas')).transform};});
    for(const [width,height] of [[1280,720],[1440,900],[1920,1080],[1920,900],[2560,1440]]){
      await page.setViewportSize({width,height});
      for(const label of ['当前布局','宽度自适应','双向自适应']){
        await frame.getByRole('button',{name:label,exact:true}).click();await settle();
        assert.equal(await frame.locator('.portal-search').evaluate(el=>getComputedStyle(el).height),'58px');
        const geometry=await frame.locator('.portal-search').evaluate(el=>{const canvas=document.querySelector('.portal-canvas');return {width:el.offsetWidth,expected:Math.max(680,Math.min(1120,canvas.clientWidth*.44)),input:el.querySelector('input').getBoundingClientRect().height,height:el.getBoundingClientRect().height}});
        assert(Math.abs(geometry.width-geometry.expected)<=1,'Search width stays unchanged');assert(geometry.input<=geometry.height,'Text fits input');
        assert(await frame.locator('.portal-canvas').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return Math.abs(m.a-m.d)<.00001}),'Text and icons must never stretch differently by axis');
        if(width===1920 && height===1080){
          for(const [selector,expected] of [['.portal-header',250],['.workbench',460],['.thematic',320]])assert(Math.abs((await frame.locator(selector).boundingBox()).height-expected)<1,selector+' matches the reference design');
          for(const [label,selector,count] of [['工作台报表列表','.workbench-card',8],['专题目录列表','.topic-card',6],['快捷入口列表','.quick-entry',5]]){
            assert(await frame.getByRole('region',{name:label}).evaluate((el,{selector,count})=>{const items=el.querySelectorAll(selector),last=items[Math.min(count,items.length)-1];return last.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom+1},{selector,count}),label+' shows the reference rows completely; additional items may scroll');
          }
        }
        if(label==='双向自适应'){
          assert(await frame.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Fit fills the viewport without stretching');
          const beforeHeight=(await frame.locator('.workbench').boundingBox()).height;
          await frame.getByRole('button',{name:'我常用的',exact:true}).click();
          assert(Math.abs((await frame.locator('.workbench').boundingBox()).height-beforeHeight)<1,'More reports do not resize their panel');
          const scroll=frame.getByRole('region',{name:'工作台报表列表'});
          assert(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight),'Extra reports stay reachable through panel scrolling');
          await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});assert(await scroll.evaluate(el=>el.scrollTop>0));
          await frame.getByRole('button',{name:'最近打开',exact:true}).click();
        }
        for(const all of [false,true]){
          const before=await read();
          await frame.evaluate(()=>{window.layoutSamples=[];window.sampling=true;function sample(){const main=document.querySelector('.home-layout').getBoundingClientRect(), bg=document.querySelector('.portal-viewport').getBoundingClientRect();window.layoutSamples.push({w:main.width,h:main.height,bg:bg.width});if(window.sampling)requestAnimationFrame(sample)}sample()});
          if(all)await frame.getByRole('button',{name:'全部公告 ›'}).click();else await frame.locator('.notices .notice-row').first().click();
          await frame.getByRole('dialog').waitFor();
          if(all){await frame.locator('.ant-modal-body .notice-row').first().waitFor();await frame.locator('.ant-modal-body .notice-row').first().click();await frame.getByRole('button',{name:'我知道了',exact:true}).click();await frame.getByRole('button',{name:'我知道了',exact:true}).waitFor({state:'hidden'});}
          assert.deepEqual(await read(),before,'Opening notices keeps home content, size and scale');
          if(all)await frame.locator('.ant-modal-close').filter({visible:true}).click();else await frame.getByRole('button',{name:'我知道了',exact:true}).click();
          await frame.getByRole('dialog').waitFor({state:'hidden'});
          const samples=await frame.evaluate(()=>{window.sampling=false;return window.layoutSamples});
          for(const key of ['w','h','bg'])assert(Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]))<1,'No modal-induced layout jitter: '+key);
          assert.deepEqual(await read(),before,'Closing notices restores the same view');
        }
      }
      await frame.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
      await page.screenshot({path:`artifacts/qa/restored-home-${width}x${height}.png`});
    }
    // Extreme aspect ratios retain readable geometry and expose overflow instead of crushing it.
    for(const [width,height] of [[2560,720],[1440,1200],[1024,768]]){
      await page.setViewportSize({width,height});
      await frame.waitForFunction(()=>{const canvas=document.querySelector('.portal-canvas'),m=new DOMMatrix(getComputedStyle(canvas).transform),box=document.querySelector('.portal-frame').getBoundingClientRect();return Math.abs(m.a-m.d)<.00001 && Math.abs(box.width-Math.max(1280,document.documentElement.clientWidth))<1 && Math.abs(box.height-Math.max(innerHeight,800*m.a))<1});
      assert(await frame.locator('.entry-icon').first().evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-el.offsetWidth/el.offsetHeight)<.001}),'Icon aspect ratio survives extreme embeds');
      if(width<1280)assert(await frame.evaluate(()=>document.documentElement.scrollWidth>=1280),'Narrow embeds keep desktop horizontal scrolling');
      if(width===2560)assert(await frame.evaluate(()=>document.documentElement.scrollHeight>innerHeight),'Very short embeds scroll rather than squash content');
    }
    await page.setViewportSize({width:1920,height:900});
    await frame.getByRole('link',{name:'报表字典',exact:true}).click();await frame.locator('.dictionary-card').first().waitFor();
    const left=await frame.locator('.filters').boundingBox(),right=await frame.locator('.dictionary-panel').boundingBox();
    assert(Math.abs(left.y+left.height-right.y-right.height)<1,'Fit dictionary bottoms align');
    const dictionary=frame.getByRole('region',{name:'报表字典列表'});await dictionary.evaluate(el=>{el.scrollTop=el.scrollHeight});assert(await dictionary.evaluate(el=>el.scrollTop>0),'Dictionary overflow remains accessible');
    await page.screenshot({path:'artifacts/qa/restored-dictionary-fit.png'});
    await frame.getByRole('link',{name:'返回首页',exact:true}).click();await frame.locator('.workbench-card').first().waitFor();
    await frame.getByRole('button',{name:'当前布局',exact:true}).click();await settle();
    await frame.getByRole('button',{name:'宽度自适应',exact:true}).click();
    await frame.evaluate(()=>window.modeTransitions.at(-1).ready);
    assert(await frame.evaluate(()=>document.getAnimations().some(a=>a.effect.getTiming().duration===280)),'Mode change runs a 280ms animation');await settle();
    await frame.evaluate(()=>{for(const text of ['双向自适应','当前布局','宽度自适应','双向自适应'])[...document.querySelectorAll('.display-mode-switch button')].find(b=>b.textContent===text).click()});await settle();
    assert.equal(await frame.locator('.portal-viewport').getAttribute('data-display-mode'),'fit','Rapid switches keep final selection');
    await page.emulateMedia({reducedMotion:'reduce'});const count=await frame.evaluate(()=>window.modeTransitions.length);
    await frame.getByRole('button',{name:'当前布局',exact:true}).click();assert.equal(await frame.evaluate(()=>window.modeTransitions.length),count,'Reduced motion skips animation');
    await frame.evaluate(()=>{document.startViewTransition=undefined});await page.emulateMedia({reducedMotion:'no-preference'});
    await frame.getByRole('button',{name:'双向自适应',exact:true}).click();assert.equal(await frame.locator('.portal-viewport').getAttribute('data-display-mode'),'fit','Older browsers can still switch modes');
    await frame.getByRole('combobox',{name:'搜索报表'}).click();await frame.locator('.search-result-row').first().waitFor();
    assert((await frame.locator('.search-dropdown').boundingBox()).height<=400);await frame.getByRole('region',{name:'搜索内容'}).hover();
    assert.equal(await frame.getByRole('region',{name:'搜索内容'}).evaluate(el=>getComputedStyle(el).getPropertyValue('--scroll-thumb').trim()),'#1677ff');
    await frame.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
    await page.screenshot({path:'artifacts/qa/restored-search-release.png',fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS: reference proportions, uniform scaling at normal and extreme aspect ratios, internal scrolling, dictionary alignment, real iframe scrollbars, stable individual/all/nested notices, animation, rapid switching, reduced motion and fallback.');
  } finally {if(live)await context.request.post(base+'/poc/logout',{headers:{Origin:base},data:{}});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
