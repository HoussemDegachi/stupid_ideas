#!/usr/bin/env python3
"""
gastric — run Python programs through a digestive system.

    py gastric.py program.py [args...]
    py gastric.py --quiet program.py

Rules
  1. Every variable (assignments, loop variables, function parameters) must be food.
  2. `from diet import vegan` (or `import vegan`) adds dietary restrictions.
  3. The value you assign is the portion size:  bacon = 3  -> three portions of bacon.

Outcome
  healthy   the program runs normally
  bloated   the program runs, but 💩 leaks into its output
  overflow  DiarrheaError — the program never runs
"""
from __future__ import annotations

import ast
import os
import random
import re
import sys
import traceback
import types
from dataclasses import dataclass

# ============================================================== food database
# fat: fills the stomach      dairy: gas pressure     spice: heat
# bulk: neutral filling       fiber: drains it all    antacid: calms gas + heat
FOODS: dict[str, dict] = {
    # fat
    "bacon": dict(fat=30), "beef_patty": dict(fat=28), "burger": dict(fat=26, bulk=6),
    "sausage": dict(fat=24), "hot_dog": dict(fat=22, bulk=4), "fries": dict(fat=18, bulk=6),
    "butter": dict(fat=24, dairy=8), "donut": dict(fat=16, bulk=8), "fried_chicken": dict(fat=24),
    "steak": dict(fat=20), "lard": dict(fat=40), "mayo": dict(fat=22), "avocado": dict(fat=10, fiber=4),
    "salmon": dict(fat=12), "tuna": dict(bulk=8), "shrimp": dict(bulk=6), "lobster": dict(fat=8, bulk=4),
    # dairy
    "cheddar": dict(fat=12, dairy=30), "cheese": dict(fat=12, dairy=28), "mozzarella": dict(fat=10, dairy=26),
    "brie": dict(fat=14, dairy=32), "parmesan": dict(fat=10, dairy=22), "milk": dict(dairy=28),
    "ice_cream": dict(fat=10, dairy=34), "cream": dict(fat=12, dairy=30), "whipped_cream": dict(fat=12, dairy=26),
    "milkshake": dict(fat=8, dairy=40), "yogurt": dict(dairy=16, fiber=2), "pizza": dict(fat=14, dairy=18, bulk=10),
    # spice
    "jalapeno": dict(spice=30), "habanero": dict(spice=45), "ghost_pepper": dict(spice=70),
    "sriracha": dict(spice=24), "wasabi": dict(spice=28), "curry": dict(spice=22, fat=6),
    "chili": dict(spice=26, fat=8), "hot_wings": dict(spice=30, fat=16), "salsa": dict(spice=16, fiber=2),
    "nachos": dict(spice=14, dairy=14, fat=10), "taco": dict(spice=12, fat=10, bulk=6), "kimchi": dict(spice=18, fiber=4),
    # bulk / neutral
    "rice": dict(bulk=10), "bread": dict(bulk=12), "bun": dict(bulk=10), "pasta": dict(bulk=14),
    "potato": dict(bulk=12), "noodles": dict(bulk=12), "bagel": dict(bulk=14), "pancake": dict(bulk=12, fat=4),
    "cake": dict(bulk=10, fat=10), "cookie": dict(bulk=8, fat=6), "egg": dict(fat=6, bulk=4),
    "chicken": dict(bulk=8, fat=4), "tofu": dict(bulk=6), "fish": dict(bulk=8), "sushi": dict(bulk=8),
    "banana": dict(bulk=6, fiber=4), "tomato": dict(bulk=3, fiber=3), "onion": dict(bulk=3, fiber=3),
    "lettuce": dict(fiber=8), "pickle": dict(bulk=2), "ketchup": dict(bulk=3), "sugar": dict(bulk=8),
    "corn": dict(bulk=8, fiber=4), "peanut": dict(fat=10), "almond": dict(fat=8, fiber=4),
    # fiber
    "celery": dict(fiber=25), "broccoli": dict(fiber=20), "kale": dict(fiber=22), "spinach": dict(fiber=16),
    "oats": dict(fiber=18), "oatmeal": dict(fiber=18), "lentils": dict(fiber=20), "beans": dict(fiber=18),
    "prune": dict(fiber=30), "apple": dict(fiber=10), "pear": dict(fiber=12), "carrot": dict(fiber=10),
    "salad": dict(fiber=14), "water": dict(fiber=8), "cucumber": dict(fiber=8),
    # remedies
    "antacid": dict(antacid=40), "ginger": dict(antacid=20, fiber=4), "peppermint_tea": dict(antacid=25),
}

MEAT = {"bacon", "beef_patty", "burger", "sausage", "hot_dog", "steak", "fried_chicken",
        "chicken", "hot_wings", "lard"}
PORK = {"bacon", "sausage", "hot_dog", "lard"}
FISH = {"fish", "sushi", "salmon", "tuna"}
SHELLFISH = {"shrimp", "lobster"}
DAIRY = {n for n, f in FOODS.items() if f.get("dairy")}
EGG = {"egg", "mayo", "cake", "pancake", "cookie", "donut"}
GLUTEN = {"bread", "bun", "pasta", "noodles", "bagel", "pancake", "cake", "cookie", "donut",
          "pizza", "burger", "hot_dog"}
CARBS = {n for n, f in FOODS.items() if f.get("bulk", 0) >= 8} | {"fries", "donut"}
SPICY = {n for n, f in FOODS.items() if f.get("spice")}
NUTS = {"peanut", "almond"}

# diet name -> (forbidden foods, reason)
DIETS: dict[str, tuple[set[str], str]] = {
    "vegan":        (MEAT | FISH | SHELLFISH | DAIRY | EGG, "contains animal products"),
    "vegetarian":   (MEAT | FISH | SHELLFISH, "contains meat"),
    "pescatarian":  (MEAT, "contains meat that isn't fish"),
    "lactose_free": (DAIRY, "contains lactose"),
    "gluten_free":  (GLUTEN, "contains gluten"),
    "keto":         (CARBS, "contains carbs"),
    "halal":        (PORK, "contains pork"),
    "kosher":       (PORK | SHELLFISH, "is not kosher"),
    "mild":         (SPICY, "is too spicy"),
    "nut_free":     (NUTS, "contains nuts"),
}

CAUSES = {
    "fat":   ("Acute Lipid Overflow", "celery = 1"),
    "bulk":  ("Carbohydrate Gridlock", "prune = 1"),
    "dairy": ("Lactose Pressure Rupture", "antacid = 1"),
    "spice": ("Capsaicin Riot", "antacid = 1"),
}

EXEMPT = {"_", "self", "cls"}


def lookup(raw: str) -> str | None:
    """Return the canonical food name for a variable name, or None if it isn't food."""
    n = re.sub(r"([a-z])([A-Z])", r"\1_\2", raw).lower()
    n = re.sub(r"\d+$", "", n).rstrip("_")

    def hit(x: str) -> str | None:
        if x in FOODS:
            return x
        if x.endswith("s") and x[:-1] in FOODS:
            return x[:-1]
        return None

    if (h := hit(n)):
        return h
    parts = n.split("_")  # allow adjectives: extra_crispy_bacon, double_beef_patty
    for k in range(len(parts) - 1, 0, -1):
        if (h := hit("_".join(parts[-k:]))):
            return h
    return None


# ============================================================== analysis
@dataclass
class Serving:
    name: str
    food: str | None
    portions: float
    line: int
    col: int
    eaten: bool  # False for function parameters: must be food, but adds nothing


@dataclass
class Problem:
    kind: str
    message: str
    line: int
    col: int
    width: int


def portion_of(node: ast.AST | None) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return max(0.0, min(10.0, float(node.value)))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return 0.0
    return 1.0


def analyze(tree: ast.AST):
    portions: dict[int, float] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    portions[id(t)] = portion_of(node.value)
        elif isinstance(node, (ast.AnnAssign, ast.AugAssign)) and isinstance(node.target, ast.Name):
            portions[id(node.target)] = portion_of(node.value)

    servings: list[Serving] = []
    diets: list[tuple[str, int]] = []
    problems: list[Problem] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            servings.append(Serving(node.id, None, portions.get(id(node), 1.0), node.lineno, node.col_offset, True))
        elif isinstance(node, ast.arg):
            servings.append(Serving(node.arg, None, 0.0, node.lineno, node.col_offset, False))
        elif isinstance(node, ast.Import):
            for a in node.names:
                parts = a.name.split(".")
                if parts[0] == "diet" and len(parts) > 1:
                    _add_diet(parts[1], node, diets, problems)
                elif parts[0] in DIETS:
                    diets.append((parts[0], node.lineno))
        elif isinstance(node, ast.ImportFrom) and node.module and node.module.split(".")[0] in ("diet", "diets"):
            for a in node.names:
                if a.name == "*":
                    diets.extend((d, node.lineno) for d in DIETS)
                else:
                    _add_diet(a.name, node, diets, problems)

    servings = [s for s in servings if s.name not in EXEMPT and not s.name.startswith("__")]
    servings.sort(key=lambda s: (s.line, s.col))

    for s in servings:
        s.food = lookup(s.name)
        if s.food is None:
            problems.append(Problem("IndigestionError",
                                    f"'{s.name}' is not food. The stomach refuses to digest it.",
                                    s.line, s.col, len(s.name)))

    active = {d for d, _ in diets}
    for s in servings:
        if s.food is None:
            continue
        for d in sorted(active):
            forbidden, reason = DIETS[d]
            if s.food in forbidden:
                problems.append(Problem("DietaryViolationError",
                                        f"'{s.name}' {reason} (you imported {d}).",
                                        s.line, s.col, len(s.name)))
    if "kosher" in active:
        foods = [s for s in servings if s.food]
        if any(s.food in MEAT for s in foods):
            for s in foods:
                if s.food in DAIRY:
                    problems.append(Problem("DietaryViolationError",
                                            f"'{s.name}' mixes dairy with meat (you imported kosher).",
                                            s.line, s.col, len(s.name)))
    problems.sort(key=lambda p: (p.line, p.col))
    return servings, sorted(active), problems


def _add_diet(name, node, diets, problems):
    if name in DIETS:
        diets.append((name, node.lineno))
    else:
        problems.append(Problem("UnknownDietError",
                                f"No such diet '{name}'. Known diets: {', '.join(DIETS)}.",
                                node.lineno, node.col_offset, 0))


# ============================================================== digestion
def digest(servings):
    t = dict(fat=0.0, dairy=0.0, spice=0.0, bulk=0.0, fiber=0.0, antacid=0.0)
    for s in servings:
        if s.eaten and s.food:
            for k in t:
                t[k] += FOODS[s.food].get(k, 0) * s.portions
    fill_raw = t["fat"] + 0.4 * t["dairy"] + 0.3 * t["spice"] + t["bulk"]
    fill = max(0.0, fill_raw - t["fiber"] - 0.4 * t["antacid"])
    gas = max(0.0, t["dairy"] - t["antacid"] - 0.3 * t["fiber"])
    heat = max(0.0, t["spice"] - t["antacid"] - 0.3 * t["fiber"])
    return types.SimpleNamespace(**t, fill=fill, gas=gas, heat=heat, severity=max(fill, gas, heat))


def stage_of(sev: float) -> str:
    if sev >= 100:
        return "diarrhea"
    if sev >= 45:
        return "bloated"
    return "healthy"


def cause_of(d) -> str:
    if d.heat >= d.fill and d.heat >= d.gas:
        return "spice"
    if d.gas >= d.fill:
        return "dairy"
    return "fat" if d.fat >= d.bulk else "bulk"


# ============================================================== output helpers
COLOR = sys.stderr.isatty() and os.environ.get("NO_COLOR") is None
if os.name == "nt":
    os.system("")  # enable ANSI escape codes in the Windows console


def c(code: str, s: str) -> str:
    return f"\033[{code}m{s}\033[0m" if COLOR else s


STAGE_STYLE = {"healthy": ("95", "HEALTHY"), "bloated": ("93", "BLOATED"), "diarrhea": ("91", "DIARRHEA")}


def banner(d, stage, diets, path):
    pct = d.severity
    width = 20
    filled = min(width, round(width * pct / 100))
    bar = "█" * filled + "░" * (width - filled)
    code, label = STAGE_STYLE[stage]
    extras = []
    if diets:
        extras.append("diet: " + ", ".join(diets))
    line = f"🫃 {os.path.basename(path)}  stomach {c(code, bar)} {pct:3.0f}%  {c(code + ';1', label)}"
    if extras:
        line += "  " + c("2", "· " + " · ".join(extras))
    print(line, file=sys.stderr)
    if pct >= 75 and stage != "diarrhea":
        print(c("93", "   *gurgle*  🤢 Your program is not feeling well."), file=sys.stderr)
    print(file=sys.stderr)


def report_problems(path, src_lines, problems):
    for p in problems:
        print(c("2", f'  File "{path}", line {p.line}'), file=sys.stderr)
        text = src_lines[p.line - 1] if 0 < p.line <= len(src_lines) else ""
        stripped = text.lstrip()
        indent = len(text) - len(stripped)
        print("    " + stripped, file=sys.stderr)
        if p.width:
            print("    " + " " * (p.col - indent) + c("91", "^" * p.width), file=sys.stderr)
        print(c("91;1", p.kind) + f": {p.message}\n", file=sys.stderr)


def report_diarrhea(path, src_lines, servings, d):
    key = cause_of(d)
    cause, rx = CAUSES[key]
    # the line that tipped the stomach over
    eaten = [s for s in servings if s.eaten]
    tip = eaten[-1]
    for i in range(len(eaten)):
        before = digest(eaten[:i]).severity
        after = digest(eaten[: i + 1]).severity
        if before < 100 <= after:
            tip = eaten[i]
    expelled = []
    for s in eaten:
        if FOODS[s.food].get(key, 0) > 0 and s.name not in expelled:
            expelled.append(s.name)

    print(c("91", "💩" * 12), file=sys.stderr)
    print("Traceback (most recent call last):", file=sys.stderr)
    print(f'  File "{path}", line {tip.line}, in <stomach>', file=sys.stderr)
    print("    " + src_lines[tip.line - 1].strip(), file=sys.stderr)
    print(c("91;1", "DiarrheaError") + f": {cause}. Expelled: {', '.join(expelled)}.", file=sys.stderr)
    print(c("2", f"  Hint: add `{rx}` to settle it down."), file=sys.stderr)


class PoopStream:
    """Wraps stdout and lets 💩 leak between words and at line ends."""

    def __init__(self, inner, density: float):
        self.inner = inner
        self.density = density
        self.prev_word = False

    def write(self, s: str) -> int:
        out = []
        for chunk in re.split(r"(\n| +)", s):
            if not chunk:
                continue
            if chunk == "\n":
                if self.prev_word:
                    out.append(" 💩")
                out.append("\n")
                self.prev_word = False
            elif chunk.isspace():
                if self.prev_word and random.random() < self.density:
                    out.append(" 💩")
                out.append(chunk)
                self.prev_word = False
            else:
                out.append(chunk)
                self.prev_word = True
        self.inner.write("".join(out))
        return len(s)

    def __getattr__(self, name):
        return getattr(self.inner, name)


def install_diet_modules():
    """Make `import vegan` / `from diet import keto` importable at runtime."""
    pkg = types.ModuleType("diet")
    pkg.__path__ = []
    sys.modules["diet"] = sys.modules["diets"] = pkg
    for name, (forbidden, reason) in DIETS.items():
        m = types.ModuleType(f"diet.{name}")
        m.FORBIDDEN = frozenset(forbidden)
        m.REASON = reason
        setattr(pkg, name, m)
        sys.modules[f"diet.{name}"] = m
        sys.modules.setdefault(name, m)


# ============================================================== main
def main(argv: list[str]) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass

    quiet = False
    while argv and argv[0].startswith("-"):
        flag = argv.pop(0)
        if flag in ("-q", "--quiet"):
            quiet = True
        elif flag in ("-h", "--help"):
            print(__doc__)
            return 0
        else:
            print(f"gastric: unknown option {flag}", file=sys.stderr)
            return 2
    if not argv:
        print(__doc__)
        return 2

    path = argv[0]
    with open(path, encoding="utf-8") as f:
        src = f.read()
    src_lines = src.splitlines()

    try:
        tree = ast.parse(src, filename=path)
    except SyntaxError as e:
        print(f'  File "{path}", line {e.lineno}\n    {(e.text or "").strip()}', file=sys.stderr)
        print(c("91;1", "SyntaxError") + f": {e.msg} (the stomach can't even chew this)", file=sys.stderr)
        return 1

    servings, diets, problems = analyze(tree)
    if problems:
        report_problems(path, src_lines, problems)
        print(c("2", f"🫃 {len(problems)} problem(s). Nothing was swallowed."), file=sys.stderr)
        return 1

    d = digest(servings)
    stage = stage_of(d.severity)
    if not quiet or stage == "diarrhea":
        banner(d, stage, diets, path)
    if stage == "diarrhea":
        report_diarrhea(path, src_lines, servings, d)
        return 1

    # --- the program is digestible: run it
    install_diet_modules()
    sys.argv = argv
    sys.path.insert(0, os.path.dirname(os.path.abspath(path)))
    real_stdout = sys.stdout
    if stage == "bloated":
        density = 0.12 + 0.5 * min(1.0, (d.severity - 45) / 55)
        sys.stdout = PoopStream(real_stdout, density)
    module = {"__name__": "__main__", "__file__": path, "__builtins__": __builtins__}
    try:
        exec(compile(tree, path, "exec"), module)
    except SystemExit as e:
        return e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
    except BaseException as e:
        sys.stdout = real_stdout
        tb = e.__traceback__.tb_next if e.__traceback__ else None  # hide gastric's own frame
        traceback.print_exception(type(e), e, tb)
        return 1
    finally:
        sys.stdout.flush()
        sys.stdout = real_stdout
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
