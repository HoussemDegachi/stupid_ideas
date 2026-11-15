# Gastric Compiler

Your code has a stomach. Every variable is food, and too much food has consequences.

## Terminal: `gastric.py` (Python)

```
py gastric.py examples/healthy.py
py gastric.py --quiet program.py     # hide the stomach banner
```

**Rules**
1. Every variable must be food: assignments, loop variables and function parameters.
   `counter = 0` → `IndigestionError`. Adjectives are fine: `extra_crispy_bacon`.
2. The value is the portion size: `bacon = 3` is three portions.
3. Import dietary restrictions: `from diet import vegan` or `import keto`.
   Diets: vegan, vegetarian, pescatarian, lactose_free, gluten_free, keto, halal, kosher, mild, nut_free.
   Breaking one → `DietaryViolationError`.

**What happens**

| Stomach  | Load    | Result |
|----------|---------|--------|
| Healthy  | < 45%   | The program runs normally |
| Bloated  | 45–99%  | It runs, but 💩 leaks into the output (more as the load rises) |
| Overflow | ≥ 100%  | `DiarrheaError`. The program never runs |

Nutrients: **fat** fills the stomach, **dairy** builds gas, **spice** builds heat, and **fiber**
(celery, broccoli, prune…) drains it. An **antacid** neutralizes gas and heat.
Each kind of overflow has its own diagnosis: *Acute Lipid Overflow*, *Lactose Pressure Rupture*,
*Capsaicin Riot* or *Carbohydrate Gridlock*.

Try every file in [examples/](examples/).

## Browser: `index.html`

A live visual prototype: a stomach beside an editor reacts as you type. Open it in a browser.
