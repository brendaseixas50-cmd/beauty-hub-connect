import asyncio, json
from playwright.async_api import async_playwright
st = json.load(open(".qa/state.json"))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width":1280,"height":1800})
        pg = await c.new_page()
        errs=[]; nets=[]
        pg.on("pageerror", lambda e: errs.append(("pageerror",str(e)[:600])))
        pg.on("console", lambda m: errs.append(("console",m.text[:400])) if m.type=="error" else None)
        async def on_resp(r):
            if r.status>=400 or "serverFn" in r.url:
                try: body=(await r.text())[:600]
                except Exception: body="?"
                nets.append((r.status, r.url.split("?")[0][:120], body))
        pg.on("response", lambda r: asyncio.create_task(on_resp(r)))
        async def dump(tag):
            print(f"--- {tag} url={pg.url}")
            print((await pg.inner_text("body"))[:500].replace("\n"," | "))
        await pg.goto("http://localhost:8080/login", wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.fill('input[type=email]', st["email"]); await pg.fill('input[type=password]', st["password"])
        await pg.get_by_role("button", name="Entrar").first.click()
        await pg.wait_for_timeout(6000)
        await pg.goto("http://localhost:8080/painel/servicos", wait_until="networkidle")
        await pg.wait_for_timeout(3000); await dump("servicos")
        async def open_dialog():
            await pg.evaluate("""() => {
              const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Novo serviço'));
              b.click();
            }""")
            await pg.wait_for_timeout(1500)
        # combo
        await open_dialog()
        await dump("dialog")
        await pg.fill('#name', "QA Combo Teste")
        await pg.get_by_text("Este serviço é um combo").first.click()
        await pg.wait_for_timeout(800)
        await pg.screenshot(path="/dev-server/.qa/combo-dialog.png")
        boxes = pg.locator('[role=dialog] input[type=checkbox]')
        print("checkboxes", await boxes.count())
        # check composition boxes (skip 'active' switch etc) - click labels containing service names
        for nm in ["Corte feminino","Coloração"]:
            loc = pg.locator(f'[role=dialog] label:has-text("{nm}")')
            if await loc.count(): await loc.first.click(); print("checked", nm)
            await pg.wait_for_timeout(200)
        await pg.evaluate("""() => { const b=[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.trim().startsWith('Salvar')); b.click(); }""")
        await pg.wait_for_timeout(6000)
        await dump("after combo save")
        await pg.screenshot(path="/dev-server/.qa/after-combo.png")
        print("ERRS", json.dumps(errs[:8], ensure_ascii=False))
        print("NETS", json.dumps(nets[-8:], ensure_ascii=False))
        await b.close()
asyncio.run(main())
