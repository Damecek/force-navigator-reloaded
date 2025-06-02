# Force Navigator (Salesforce Navigator for Lightning)

**Popis repozitáře:**  
 Repozitář obsahuje kód pro Chrome rozšíření „Salesforce Navigator for Lightning“ (interně nazývané Force Navigator), které umožňuje rychlou a efektivní navigaci v rámci Salesforce Lightning i Classic.

**Hlavní funkce:**

- Rychlé vyhledávání a navigace:  
  • Procházení a vyhledávání záznamů pomocí příkazů `? <vyhledávací_znaky>`.  
  • Vytváření nových záznamů příkazem `New <Objekt>`.  
  • Přímý přístup k seznamům zobrazení pomocí `List <Objekt>`.
- Správa úkolů na míru:  
  • Vkládání úkolů přes `! <popis úkolu>`.  
  • Rychlý přístup k záložce Úkoly.
- Administrativní a nastavovací příkazy:  
  • Přepínání mezi Lightning a Classic (`Toggle Lightning`).  
  • Obnovení metadat (`Refresh Metadata`).  
  • Login jako jiný uživatel (`Login as <uživatelské_jméno>`).  
  • Volba a uložení tématu (Default, Dark, Unicorn, Solarized).
- Rozšířené možnosti:  
  • Hromadné přepínání zaškrtávacích políček.  
  • Volitelné otevření výsledků v novém panelu (Shift/Ctrl + Enter).  
  • Podpora vlastních domén a CSP Trusted Sites.

**Architektura a stack:**

- Frontend: TypeScript/JavaScript, React + Lisan, Mousetrap (klávesové zkratky).
- Nástroj pro sestavení: Webpack (konfigurace v `config/`).
- Vstupní body: `public/` (manifest.json, popup.html, styly).
- Výstup: `build/` obsahující prohlížečové balíčky (background, content scripts, servisní pracovník).

**Další zdroje:**

- Oficiální dokumentace a demo: `web/index.html` (+ obrázky `web/*.png`).
- Konfigurační detaily: adresáře `config/`, `src/`.
- Uživatelská dokumentace a obrázky: `store-details/`.

---

_Prepared for senior engineering review._

## Implementační specifikace

Návrh ideální architektury a modulů pro refaktoring jednotlivých funkcí od základu:

1.  Rychlé vyhledávání a navigace

    - Command Parser: modul pro čisté rozdělení vstupu na příkaz a parametry.
    - Metadata Service: asynchronní načítání a cachování metadat (objektové schéma, seznamy zobrazení, URL mapování).
    - URL Mapping Engine: generování správných odkazů pro Lightning i Classic.
    - UI Component: samostatná vrstva pro zobrazení výsledků s klávesovou navigací.
    - Error Handling: centralizovaná validace vstupu a reporting chyb.

2.  Tvorba nových záznamů (New <Object>)

    - Command Factory: abstraktní konstruktor příkazů pro různé objekty.
    - Input Validator: ověřování existence objektu a povinných polí.
    - Navigation Adapter: jednotné API pro otevírání URL, nové okno nebo záložku.

3.  Seznamy zobrazení (List Views)

    - View Registry: deklarativní definice dostupných seznamů pro každý objekt.
    - Lazy Loader: načítání metadat seznamů až na vyžádání.
    - Prefetch Engine: přednahrávání často používaných seznamů pro rychlejší odezvu.

4.  Správa úkolů (! <task>)

    - Task Composer: formátování a generování URL pro vytvoření úkolu.
    - Context Resolver: detekce kontextu (uživatel, stránka) pro předvyplnění polí.
    - Confirmation UI: vizuální zpětná vazba o úspěšném vytvoření nebo chybě.

5.  Administrativní a nastavovací příkazy

    - Toggle Manager: abstrakce přepínání Lightning/Classic s reverzibilním URL přemapováním.
    - Metadata Refresher: modul pro manuální i automatické obnovení metadat.
    - Session Controller: bezpečné čtení a správa session tokenu (cookie, storage).
    - User Switcher: lookup a přepínání uživatele pro „Login As“.

6.  Nastavení a témata

    - Settings Provider: perzistentní storage pro uživatelské preference (téma, zkratky).
    - Theme Engine: modulární systém pro definici barevných schémat a layoutu.
    - Settings UI: komponenta pro úpravu a validaci nastavení s rollbackem.

7.  Rozšířené operace
    - Batch Processor: jednotkový modul pro hromadné operace (checkbox toggle) se zpětnou korekcí.
    - Link Opener: konfigurovatelná logika otevírání výsledků (stejný panel vs. nový panel/záložka).
    - Domain Adapter: pluginová vrstva pro vlastní domény, CSP a interní URL mapování.

**Klíčové principy:**

- Single Responsibility: každý modul jeden úkol, čisté hranice zodpovědnosti.
- Dependency Injection: výměna implementací pro testování a rozšíření.
- Asynchronní a reakční zpracování: jasné stavy načítání, chybová hlášení.
- Bezpečnost: minimální oprávnění (cookies, storage, messaging), zabezpečená komunikace.
- Modularita: otevřené API pro přidávání nových příkazů a rozšíření bez zásahu do jádra.
