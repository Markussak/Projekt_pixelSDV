# 2D 16-Bit Space Open-World Game - Design Document

## Základní koncept
**Název:** Space Explorer 16-Bit (pracovní název)
**Žánr:** 2D Open-World Space Exploration, RPG, Simulation
**Styl:** 16-bitový pixelový, retro CRT-heavy estetika

## Vizuální styl a estetika

### Grafický styl
- **16-bitový pixelový artwork** s detailními texturami
- **Dithering techniky** pro plynulé přechody barev
- **Shadowing a depth efekty** pro prostorovou hloubku
- **Temné, tmavé barevné palety** s bohatými odstíny
- **Retro CRT-heavy aesthetic** - analogové monitory, rušení, scanlines
- **Mechanické, masivní klávesnice a tlačítka**
- **Opotřebované, poškozené, použité prvky**

### UI Design
- Veškeré UI prvky v 16-bitovém stylu
- Pixelové fonty s hloubkou a stíny
- CRT monitory pro informační panely
- Mechanická tlačítka a ovládací prvky
- Dekorativní prvky: poškozené panely, nalepené poznámky, vyryté značky

## Herní mechaniky

### Struktura herního světa
1. **Dvě hlavní herní scény:**
   - **Hvězdný systém** - detailní pohled na jednotlivý systém
   - **Mezihvězdný prostor** - mapa galaxie s max. 20 viditelnými systémy

2. **Plynulé přechody** mezi scénami bez loading screenů
   - Hranice systému s pop-up upozorněním
   - Aktivace warp pohonu pro mezihvězdný cestování

### Generování světa
- **Procedurálně generovaná galaxie** s persistentním uložením
- **Unikátní hvězdné systémy** s realistickými vzdálenostmi (AU)
- **Rozmanité nebeské objekty:**
  - Hvězdy (max. 80% obrazovky)
  - Planety s atmosférami
  - Měsíce, asteroidy, komety
  - Černé díry, pulsary, dvojhvězdy
  - Supernovy, zničené planety

### Animace a pohyb
- **30-snímkové rotační animace** pro všechna tělesa
- **Realistické orbitální mechaniky**
- **Gravitační působení a setrvačnost**
- **Dynamická orbita** - měsíce kolem planet, planety kolem hvězd

### Systémové objekty
- **Mimozemské lodě** (5% spawn chance)
- **Satelity a opuštěné stanice**
- **Vraky lodí**
- **Megastruktury:** Dyson Sphere, Ring World, Hypergate
- **Obranné platformy a miny**
- **Obchodní stanice, loděnice, opravny**
- **Vesmírná města a skládky**

## Status Bar - Kokpit interfejs

### Rozložení (zdola obrazovky, max. 15%)
**5 panelů zleva doprava:**

1. **Systémy lodi:**
   - Indikátory: trup, štíty, palivo, energie
   - Ukazatel nabití warp pohonu
   - Kontrolky kritických stavů

2. **Kontrola lodi:**
   - Přepínače: štíty, warp, motory, reaktor
   - Posuvníky: tah motorů, síla štítů
   - Autodestrukce (ochranný obal)

3. **Střední panel:**
   - CRT monitor s poškozením lodi (8 sekcí)
   - Ukazatel zatížení nákladního prostoru
   - Tlačítka: inventář, kodex, výzkum, posádka

4. **Zbranové systémy:**
   - Výběr typu zbraně
   - CRT monitor s info o zbrani
   - Kontrolky přehřátí/munice/energie

5. **Radar a navigace:**
   - Reálná poloha v systému
   - Zoom kontroly
   - Mapa galaxie
   - Dva režimy: systém / mezihvězdný prostor

### Vizuální design status baru
- **3D perspektiva** - panely natočené do středu
- **Různé hloubky a tloušťky** panelů
- **Dekorativní spodní panel** s klávesnicí, páčkami
- **Opotřebované prvky:** poškozené monitory, poznámky, značky

## RPG a progresní systémy

### Level a dovednosti
- **Level systém** s pozitivními i negativními bonusy
- **Systém dovedností** ovlivňující různé aspekty hry

### Výzkum a technologie
- **Kodex** se všemi objevy a znalostmi
- **Výzkumné body** za objevy
- **Technologický strom** s vylepšeními
- **Výrobní systém** pro technologie

### Inventář systém
**Nákladní prostor lodi obsahuje:**
- Všechny prvky periodické tabulky
- Suroviny a technologie
- Elektroniku pro lod
- Sběratelské předměty a artefakty
- Munici a rakety
- Palivové koule
- Moduly a biomateriály
- Jídlo (rations)
- Mimozemské předměty
- Neznámé předměty k analýze

## Combat a interakce

### Bojový systém
- **Pokročilé combat mechaniky**
- **Různé typy zbraní:**
  - Projektilové (omezená munice)
  - Energetické (přehřívání)
  - Raketové systémy

### AI systémy
- **Pokročilá AI mimozemšťanů** navozující iluzi vědomí
- **Diplomacie systém** pro komunikaci s cizími rasami

### Správa lodi a posádky
- **Management posádky**
- **Doplňování:** palivo, zásoby, munice
- **Opravy a upgrady:** motory, reaktory, warp, trup
- **Obchodní systém**

## Interakce s nebeskými tělesy

### Orbital mechaniky
**Pop-up okno při přiblížení k tělesu:**
- Základní informace o objektu
- **Možnosti:**
  - Vstoupit na orbitu (kotevní režim)
  - Přistát (těžební mechanika)
  - Pokračovat v letu

### Těžební systém
- Aktivuje se po přistání na těleso
- Získávanie surovin pro výrobu

## Pozadí a atmosféra

### Vesmírné pozadí (více vrstev)
- **Vzdálené hvězdy** jako pixelové body
- **Miniaturní galaxie a hvězdokupy**
- **Pixelové supernovy**
- **Pruh domovské galaxie** se shlukovanými hvězdami

## Vzdálenosti a realismus

### Jednotky měření
- **AU (Astronomical Units)** pro hvězdné systémy
- **Light Years (ly)** pro mezihvězdný prostor
- **Realistické vzdálenosti a rozměry**
- **Škálování:** hráčova loď velikosti asteroidu, hvězdy max. 80% obrazovky

## Herní módy a obrazovky

### Úvodní sekvence
1. **Loading screen** s tipy a loading barem
2. **Hlavní menu** s mechanickými tlačítky
3. **New Game Setup** (5 obrazovek):
   - Nastavení hry a galaxie
   - Tvorba pilota
   - Výběr typu lodi
   - Výběr posádky
   - Shrnutí

### Persistentní uložení
- **Kompletní stav galaxie**
- **Hráčův postup a objevy**
- **Stav lodi a inventář**
- **Všechny generované systémy a objekty**

## Technické požadavky

### Výkon a optimalizace
- **Efektivní rendering** 16-bitových assetů
- **Dynamické načítanie** systémov
- **Persistent storage** pro rozsáhlý herní svět
- **Optimalizované animácie** pro 30 FPS rotácie

### Asset management
- **16-bitové assety** pro všechny objekty
- **Unikátne obrázky** pre každý item
- **Animované sprite sheets** pre rotácie
- **UI assety** v retro štýle