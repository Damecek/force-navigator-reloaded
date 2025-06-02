# MVP Backlog

Níže jsou hlavní kroky k dosažení MVP Command Palette pro Salesforce rozšíření.
Každý řádek označte [x] po dokončení úkolu.

- [ ] Error Handling: centralizovaná validace vstupu a reporting chyb v UI
- [ ] Příkaz Login as <uživatelské_jméno> (User Switcher)
- [ ] pridat seznam active flows do menu
- [ ] pridat seznam sobject specific submenu (fields, layout etc.)
- [ ] Settings Provider a UI pro uživatelská nastavení (téma, klávesové zkratky)
- [ ] Theme Engine s podporou témat (Default, Dark, Unicorn, Solarized)
- [ ] implementovat lightning navigation misto page
      goto https://github.com/tprouvot/Salesforce-Inspector-reloaded/blob/main/addon/inject.js
- [ ] zkusit implementovat wire adapter pro seznam commandu https://lwc.dev/guide/wire_adapter#wire-adapters
- [ ] implementovat record search pres ? prefix
- [ ] implementovat setup page
- [ ] obrendovat auth page
- [ ] rozmyslet, jestli neni lepsi otevrit auth page az na request usera, jakoze, neni token tak jedinej command
      authorize
