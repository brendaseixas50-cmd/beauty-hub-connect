import asyncio, json
from playwright.async_api import async_playwright
st = json.load(open(".qa/state.json"))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width":1280,"height":1800})
        pg = await c.new_page()
        errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.on("console", lambda m: errs.append("console:"+m.text[:160]) if m.type=="error" else None)
        D = lambda: pg.locator('div[role=dialog][data-tsd-source*="painel.servicos"]')
        async def dump(t): print(f"--- {t}: ", (await pg.inner_text("body"))[:300].replace("\n"," | "), flush=True)
        await pg.goto("http://localhost:8080/login", wait_until="networkidle"); await pg.wait_for_timeout(3500)
        await pg.fill('input[type=email]', st["email"]); await pg.fill('input[type=password]', st["password"])
        await pg.get_by_role("button", name="Entrar").first.click(); await pg.wait_for_timeout(6000)
        async def goto_svc():
            await pg.goto("http://localhost:8080/painel/servicos", wait_until="networkidle"); await pg.wait_for_timeout(2500)
            nb = pg.get_by_role("button", name="Agora não")
            if await nb.count(): await nb.first.click(); await pg.wait_for_timeout(500)
        async def new_dialog():
            await goto_svc()
            await pg.evaluate("""() => [...document.querySelectorAll('button')].find(e=>e.textContent.includes('Novo serviço')).click()""")
            await pg.wait_for_timeout(1200)
        async def save():
            await pg.evaluate("""() => [...document.querySelectorAll('div[role=dialog] button')].filter(e=>e.textContent.trim().startsWith('Salvar')).pop().click()""")
            await pg.wait_for_timeout(5000)
        async def edit(name):
            await goto_svc()
            await pg.evaluate("""(n) => {
              const card=[...document.querySelectorAll('div')].filter(d=>d.textContent.includes(n) && d.querySelector('button'));
              const c=card[card.length-1];
              [...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='Editar').click();
            }""", name)
            await pg.wait_for_timeout(1500)
        await new_dialog()
        await pg.fill('#name',"QA Combo Teste")
        await D().get_by_text("Este serviço é um combo").first.click(); await pg.wait_for_timeout(600)
        for nm in ["Corte feminino","Coloração"]:
            await D().locator(f'label:has-text("{nm}")').first.click(); await pg.wait_for_timeout(200)
        print("composicao:", [l for l in (await D().inner_text()).split("\n") if "Total da composição" in l], flush=True)
        await save(); await dump("after combo save")
        await new_dialog()
        await pg.fill('#name',"QA Adicional Teste")
        await D().get_by_text("Pode ser oferecido como adicional").first.click(); await pg.wait_for_timeout(600)
        for nm in ["QA Combo Teste","Corte feminino"]:
            await D().locator(f'label:has-text("{nm}")').first.click(); await pg.wait_for_timeout(200)
        await pg.fill('#price',"30,00")
        await save(); await dump("after addon save")
        await goto_svc()
        txt = await pg.inner_text("body")
        print("persist:", "QA Combo Teste" in txt, "QA Adicional Teste" in txt, "| badges:", "Combo" in txt, "Adicional" in txt, flush=True)
        await edit("QA Combo Teste")
        d = await D().inner_text()
        print("edit combo keeps composition:", "Total da composição" in d, flush=True)
        await pg.fill('#name',"QA Combo Editado"); await save(); await dump("after combo edit")
        await edit("QA Adicional Teste")
        d2 = await D().inner_text()
        print("edit addon checked count:", await D().locator('input[type=checkbox]:checked').count(), "| has addon block:", "Pode ser oferecido como adicional" in d2, flush=True)
        await pg.fill('#name',"QA Adicional Editado"); await save(); await dump("after addon edit")
        await goto_svc()
        txt2 = await pg.inner_text("body")
        print("final persist:", "QA Combo Editado" in txt2, "QA Adicional Editado" in txt2, flush=True)
        print("ERRS", json.dumps(errs[:5], ensure_ascii=False), flush=True)
        await b.close()
asyncio.run(main())
