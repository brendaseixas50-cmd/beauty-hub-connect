import asyncio, json, sys
from playwright.async_api import async_playwright
st = json.load(open(".qa/state.json"))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width":1280,"height":1800})
        pg = await c.new_page()
        errs=[]
        pg.on("console", lambda m: errs.append((m.type,m.text[:400])) if m.type in ("error",) else None)
        pg.on("pageerror", lambda e: errs.append(("pageerror",str(e)[:600])))
        async def dump(tag):
            print(f"--- {tag} url={pg.url}")
            print((await pg.inner_text("body"))[:700].replace("\n"," | "))
        # login
        await pg.goto("http://localhost:8080/login", wait_until="networkidle")
        await pg.wait_for_timeout(3500)
        await pg.fill('input[type=email]', st["email"]); await pg.fill('input[type=password]', st["password"])
        await pg.get_by_role("button", name="Entrar").first.click()
        await pg.wait_for_timeout(6000); await dump("login")
        # onboarding
        if "onboarding" in pg.url:
            await pg.get_by_role("checkbox").first.check(); await pg.wait_for_timeout(300)
            r = pg.get_by_role("radio")
            if await r.count(): await r.first.check()
            await pg.get_by_role("button", name="Continuar").first.click()
            await pg.wait_for_timeout(2500); await dump("step2")
            for name in ["Concluir","Finalizar","Salvar","Ir para o painel","Adicionar","Continuar"]:
                btn = pg.get_by_role("button", name=name)
                if await btn.count():
                    await btn.first.click(); print("clicked", name); break
            await pg.wait_for_timeout(6000); await dump("post-onboarding")
        # services page
        await pg.goto("http://localhost:8080/painel/servicos", wait_until="networkidle")
        await pg.wait_for_timeout(3000); await dump("servicos")
        async def new_service(name, combo=False, addon=False):
            await pg.get_by_role("button", name="Novo serviço").first.click()
            await pg.wait_for_timeout(1200)
            await pg.fill('#name', name)
            if combo:
                await pg.get_by_text("Este serviço é um combo").first.click()
                await pg.wait_for_timeout(600)
                boxes = pg.locator('input[type=checkbox]')
                # check first two composition options
                labels = pg.locator('label:has(input[type=checkbox]) span.truncate')
                n = await labels.count()
                print("combo options", n)
                for i in range(min(2, n)):
                    await labels.nth(i).click()
                    await pg.wait_for_timeout(200)
            if addon:
                await pg.get_by_text("Pode ser oferecido como adicional").first.click()
                await pg.wait_for_timeout(600)
                labels = pg.locator('label:has(input[type=checkbox]) span.truncate')
                if await labels.count(): await labels.first.click()
                await pg.fill('#durationMinutesPart', "15")
            await pg.fill('#price', "50,00")
            await pg.get_by_role("button", name="Salvar").first.click()
            await pg.wait_for_timeout(4000)
            await dump(f"after save {name} combo={combo} addon={addon}")
        try:
            await new_service("QA Corte")
            await new_service("QA Barba")
            await new_service("QA Combo Teste", combo=True)
            await new_service("QA Adicional Teste", addon=True)
        except Exception as e:
            print("FLOW ERROR", repr(e)[:500])
            await dump("error-state")
        await pg.screenshot(path="/dev-server/.qa/final.png")
        print("ERRS", json.dumps(errs[:12], ensure_ascii=False))
        await b.close()
asyncio.run(main())
