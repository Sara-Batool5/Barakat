#!/usr/bin/env python3
"""
Draws the sample food illustrations used in "My batches" when a batch has no real photo.
Scenes are lists of simple shapes (rect, ellipse, path, line) on a 480x360 canvas.
They are written to src/data/foodScenes.json (rendered as inline SVG by the website) and, for checking,
rendered to PNG contact sheets with PIL. Not needed to run the app.
Usage: python3 tools/food_art.py [--preview DIR]
"""
import json
import math
import os
import random
import re
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 480, 360

# ------------------------------------------------------------------ shape kit
def _r(v):
    return round(v, 1)


def R(x, y, w, h, f, rx=0, s=None, sw=0, o=1, rot=0):
    d = {"t": "r", "x": _r(x), "y": _r(y), "w": _r(w), "h": _r(h), "f": f}
    if rx: d["rx"] = _r(rx)
    if s: d["s"] = s; d["sw"] = sw
    if o != 1: d["o"] = o
    if rot: d["rot"] = _r(rot)
    return d


def E(cx, cy, rx, ry, f, s=None, sw=0, o=1, rot=0):
    d = {"t": "e", "cx": _r(cx), "cy": _r(cy), "rx": _r(rx), "ry": _r(ry), "f": f}
    if s: d["s"] = s; d["sw"] = sw
    if o != 1: d["o"] = o
    if rot: d["rot"] = _r(rot)
    return d


def P(dpath, f=None, s=None, sw=0, o=1):
    d = {"t": "p", "d": dpath}
    if f: d["f"] = f
    if s: d["s"] = s; d["sw"] = sw
    if o != 1: d["o"] = o
    return d


def L(x1, y1, x2, y2, s, sw=2, o=1):
    d = {"t": "l", "x1": _r(x1), "y1": _r(y1), "x2": _r(x2), "y2": _r(y2), "s": s, "sw": sw}
    if o != 1: d["o"] = o
    return d


def poly(points, f=None, s=None, sw=0, o=1):
    d = "M" + " L".join(f"{_r(x)} {_r(y)}" for x, y in points) + " Z"
    return P(d, f, s, sw, o)


# palette
CREAM, MINT, PEACH, SKY, BUTTER, ROSE = "#fbf1df", "#e8f4e6", "#fde6d8", "#e4eff7", "#fff4d1", "#fde4e8"
KRAFT, KRAFT_D, WOOD, WOOD_D = "#cf9f66", "#a97a45", "#e2bf94", "#bd8f5c"
GREEN, GREEN_D, TOMATO, LEMON = "#58a853", "#2f7a3a", "#d9442f", "#f7d94c"
RICE_G, RICE_O, CHICK, CHICK_D = "#f0c455", "#e8913a", "#c0702f", "#8f4a1f"
WHITE, LINE = "#ffffff", "#dcd9d0"


def shadow(cx, cy, rx, ry, o=0.12):
    return E(cx, cy, rx, ry, "#000000", o=o)


def scatter(rng, cx, cy, rx, ry, n, make):
    out = []
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r = math.sqrt(rng.random())
        out.append(make(cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r, rng))
    return out


def grains(rng, cx, cy, rx, ry, n, color, o=0.9):
    return scatter(rng, cx, cy, rx, ry, n, lambda x, y, r: E(x, y, 3.6, 1.6, color, o=o, rot=r.uniform(0, 180)))


def herbs(rng, cx, cy, rx, ry, n, color=GREEN):
    return scatter(rng, cx, cy, rx, ry, n, lambda x, y, r: E(x, y, 3.2, 2.2, color, rot=r.uniform(0, 180)))


def plate(cx=240, cy=182, r=130):
    return [shadow(cx + 5, cy + 12, r, r * 0.95, 0.14), E(cx, cy, r, r, WHITE, s=LINE, sw=2),
            E(cx, cy, r * 0.8, r * 0.8, "#f5f4ee", s="#e8e5db", sw=1.5)]


def bowl_top(cx, cy, r, inner, rim="#ffffff"):
    return [shadow(cx + 4, cy + 10, r, r * 0.95, 0.14), E(cx, cy, r, r, rim, s=LINE, sw=2), E(cx, cy, r * 0.84, r * 0.84, inner)]


def lemon_wedge(x, y, rot=0, s=1.0):
    return [E(x, y, 24 * s, 17 * s, LEMON, s="#e3bb2d", sw=2, rot=rot), E(x, y, 18 * s, 11 * s, "#fbe97e", rot=rot),
            L(x - 16 * s, y, x + 16 * s, y, "#e3bb2d", 1.5)]


def wood_board(x=40, y=70, w=400, h=230):
    return [shadow(x + w / 2 + 4, y + h / 2 + 12, w / 2, h / 2, 0.12), R(x, y, w, h, WOOD, rx=22, s=WOOD_D, sw=3)] + [
        L(x + 20, y + 40 + i * 45, x + w - 20, y + 40 + i * 45, WOOD_D, 1.5, 0.35) for i in range(4)]


# ------------------------------------------------------------------ scenes
SCENES = {}


def scene(key, bg, shapes):
    SCENES[key] = [R(0, 0, W, H, bg)] + shapes


def rice_plate(key, rice, streak, topping):
    rng = random.Random(zlib.crc32(key.encode()) & 0xFFFF)
    sh = plate()
    sh += [E(240, 182, 96, 74, rice), E(212, 152, 54, 30, WHITE, o=0.18)]
    sh += grains(rng, 240, 182, 88, 66, 46, "#fff2c4", 0.8)
    sh += scatter(rng, 240, 182, 80, 60, 9, lambda x, y, r: E(x, y, 12, 4, streak, o=0.55, rot=r.uniform(0, 180)))
    if topping == "chicken":
        for (x, y, rot) in ((175, 208, -20), (302, 206, 25), (222, 242, 8), (276, 148, -35)):
            sh += [E(x, y, 27, 17, CHICK, s=CHICK_D, sw=2.5, rot=rot), E(x - 6, y - 5, 12, 5, "#e19a55", o=0.8, rot=rot)]
    elif topping == "lamb":
        for (x, y, rot) in ((190, 205, -15), (290, 200, 20), (240, 238, 0)):
            sh += [R(x - 28, y - 18, 56, 36, "#9a5a35", rx=14, s="#6e3a1f", sw=2.5, rot=rot), R(x - 14, y - 11, 28, 10, "#b9774d", rx=5, rot=rot)]
        sh += [E(318, 168, 7, 7, WHITE, s=LINE, sw=1.5)]
    elif topping == "kabsa":
        sh += [E(240, 150, 34, 22, CHICK, s=CHICK_D, sw=2.5), E(236, 144, 16, 6, "#e19a55", o=0.8)]
        sh += scatter(rng, 240, 205, 70, 36, 14, lambda x, y, r: E(x, y, 6, 3, "#f6e4b8", s="#d9c28a", sw=1, rot=r.uniform(0, 180)))
        sh += scatter(rng, 240, 205, 70, 36, 12, lambda x, y, r: E(x, y, 3.2, 3.2, "#5a2c3a"))
        sh += [E(180, 232, 14, 14, TOMATO, s="#a6301f", sw=2), E(300, 236, 14, 14, TOMATO, s="#a6301f", sw=2)]
    elif topping == "grilled":
        for (x, y, rot) in ((205, 170, -12), (255, 178, -8), (230, 210, -10), (290, 214, -5)):
            sh += [R(x - 34, y - 12, 68, 24, "#d9a064", rx=11, s="#a9722f", sw=2, rot=rot)]
            sh += [L(x - 22 + i * 14, y - 9, x - 14 + i * 14, y + 9, "#7a4a1f", 2, 0.7) for i in range(4)]
        sh += scatter(rng, 240, 190, 112, 88, 16, lambda x, y, r: E(x, y, 4.2, 4.2, "#77b84f") if math.hypot(x - 240, y - 190) > 86 else E(x, y, 0.1, 0.1, rice, o=0))
        sh += [R(150, 250, 34, 12, "#f08a2c", rx=5, rot=-20), R(180, 258, 34, 12, "#f08a2c", rx=5, rot=10)]
    elif topping == "dal":
        sh = plate()
        sh += [E(205, 190, 74, 62, rice), E(184, 166, 40, 22, WHITE, o=0.18)] + grains(rng, 205, 190, 66, 52, 34, "#fff2c4", 0.8)
        sh += bowl_top(318, 160, 62, "#e8b23a")
        sh += scatter(rng, 318, 160, 46, 46, 10, lambda x, y, r: E(x, y, 5, 3, "#c98a1f", rot=r.uniform(0, 180)))
        sh += [E(318, 160, 18, 11, "#f3cf6a", o=0.8), R(286, 122, 14, 6, GREEN_D, rx=3, rot=30)]
        sh += herbs(rng, 318, 160, 40, 40, 8)
    sh += herbs(rng, 240, 182, 90, 70, 12)
    scene(key, CREAM, sh)


rice_plate("rice_biryani", RICE_G, RICE_O, "chicken")
rice_plate("rice_lamb", "#ead09b", "#c98a4b", "lamb")
rice_plate("rice_kabsa", "#c9904f", "#8f5a2a", "kabsa")
rice_plate("rice_grilled", "#f1e7c8", "#d9ca9a", "grilled")
rice_plate("rice_dal", "#f1e7c8", "#d9ca9a", "dal")

# stuffed vine leaves
sh = plate()
for i in range(6):
    x, y = 195 + (i % 2) * 100, 122 + (i // 2) * 42
    sh += [E(x + 3, y + 8, 46, 12, "#000000", o=0.12), R(x - 44, y - 13, 88, 26, GREEN_D, rx=13, s="#1f5a2a", sw=2.5, rot=-5 + (i % 3) * 5),
           R(x - 34, y - 8, 68, 7, "#6fb86a", rx=3, o=0.7, rot=-5 + (i % 3) * 5), L(x - 20, y - 12, x - 20, y + 12, "#1f5a2a", 1.6, 0.6), L(x + 12, y - 12, x + 12, y + 12, "#1f5a2a", 1.6, 0.6)]
sh += lemon_wedge(165, 262, 20) + lemon_wedge(318, 262, -20) + [E(240, 272, 18, 12, "#e24b3a", s="#a6301f", sw=2)]
scene("stuffed_vine", CREAM, sh)

# baked fish with rice
sh = plate()
sh += [E(310, 205, 62, 46, "#f4efe2"), E(300, 190, 30, 16, WHITE, o=0.25)] + grains(random.Random(4), 310, 205, 54, 38, 22, "#fff7de", 0.8)
fish = "M120 175 C150 135 235 130 275 168 L318 140 L304 178 L322 212 L276 188 C235 232 150 225 120 175 Z"
sh += [P(fish, "#e0a85c", "#a9722f", 3), P("M150 168 C185 150 230 150 258 172 C230 192 185 196 150 168 Z", "#efc480", o=0.8),
       E(150, 170, 5, 5, "#2a1a10"), E(150, 170, 1.8, 1.8, WHITE)]
sh += [L(190 + i * 16, 150, 196 + i * 16, 196, "#a9722f", 1.8, 0.7) for i in range(5)]
sh += lemon_wedge(175, 262, 10) + lemon_wedge(235, 270, -10) + herbs(random.Random(5), 215, 175, 70, 40, 12)
scene("baked_fish", CREAM, sh)


def curry_bowl(key, sauce, bit, bit2, bg):
    rng = random.Random(zlib.crc32(key.encode()) & 0xFFFF)
    sh = bowl_top(240, 178, 132, sauce)
    sh += [E(240, 178, 132, 132, None) if False else E(240, 178, 108, 108, sauce, s="#00000010", sw=1)]
    sh += scatter(rng, 240, 178, 96, 96, 22, lambda x, y, r: E(x, y, r.uniform(8, 13), r.uniform(7, 11), bit, s=bit2, sw=1.5, rot=r.uniform(0, 180)))
    sh += scatter(rng, 240, 178, 96, 96, 14, lambda x, y, r: E(x, y, 4, 4, bit2))
    sh += [E(210, 140, 60, 26, WHITE, o=0.12)] + herbs(rng, 240, 178, 80, 80, 16, GREEN_D)
    sh += [E(120, 296, 40, 22, "#f7f2e4", s=LINE, sw=2), E(120, 291, 30, 14, "#fffdf6")]
    scene(key, bg, sh)


curry_bowl("curry_korma", "#f0b868", "#f7e3b0", "#d9903a", PEACH)
curry_bowl("curry_chana", "#c9682f", "#e6b866", "#9a4a1f", PEACH)

# pasta
rng = random.Random(7)
sh = plate()
for i, r in enumerate((78, 62, 46, 30)):
    sh += [E(240, 182, r, r * 0.8, "#f4d77c" if i % 2 == 0 else "#efc864", s="#d9a93a", sw=2.5)]
sh += [E(240, 182, 14, 10, "#f7e6a2", s="#d9a93a", sw=2)]
sh += scatter(rng, 240, 182, 76, 60, 16, lambda x, y, r: E(x, y, 9, 7, r.choice([TOMATO, "#f08a2c", "#4f9f4a", "#f5c542"]), rot=r.uniform(0, 180)))
sh += scatter(rng, 240, 182, 80, 62, 14, lambda x, y, r: E(x, y, 3.5, 2.5, "#fff8e0"))
sh += herbs(rng, 240, 182, 70, 54, 9, GREEN_D)
scene("pasta", CREAM, sh)

# moussaka tray
sh = [shadow(244, 300, 190, 26, 0.14), R(60, 80, 360, 210, "#d9dbd6", rx=20, s="#a9aca5", sw=3), R(76, 96, 328, 178, "#c98a45", rx=12, s="#a9672f", sw=2)]
rng = random.Random(9)
sh += scatter(rng, 240, 185, 150, 78, 34, lambda x, y, r: E(x, y, r.uniform(8, 16), r.uniform(5, 9), r.choice(["#8f4a1f", "#e3a85c", "#f2c987"]), o=0.75, rot=r.uniform(0, 180)))
sh += [L(76 + i * 82, 96, 76 + i * 82, 274, "#7a3f18", 2, 0.6) for i in range(1, 4)] + [L(76, 185, 404, 185, "#7a3f18", 2, 0.6)]
sh += [E(120, 130, 10, 7, "#4f9f4a")] + [E(360, 240, 10, 7, "#4f9f4a")] + herbs(rng, 240, 185, 140, 70, 14, GREEN_D)
scene("moussaka", CREAM, sh)

# falafel & hummus box
rng = random.Random(10)
sh = [shadow(244, 312, 190, 22, 0.14), R(50, 60, 380, 240, KRAFT, rx=18, s=KRAFT_D, sw=3), R(66, 76, 348, 208, "#e8caa0", rx=12)]
sh += [L(240, 76, 240, 284, KRAFT_D, 2, 0.5)]
for (x, y) in ((120, 130), (175, 150), (135, 200), (195, 215), (110, 255), (170, 262)):
    sh += [E(x, y, 26, 26, "#7a4a1f", s="#4f2e12", sw=2.5), E(x - 7, y - 7, 10, 6, "#a8713a", o=0.8)]
    sh += scatter(rng, x, y, 18, 18, 7, lambda a, b, r: E(a, b, 2.4, 2.4, "#5a8a3a"))
sh += bowl_top(335, 135, 66, "#e9cf9d") + [E(335, 135, 34, 16, "#f3e2bd", o=0.9), E(335, 135, 40, 40, "#c9852f", o=0.0)]
sh += scatter(rng, 335, 135, 42, 42, 8, lambda x, y, r: E(x, y, 4, 4, "#c98a45")) + [E(335, 135, 44, 44, "#f0c36a", s="#e0a53a", sw=2, o=0.35)]
sh += [R(298, 218, 30, 14, "#7fae4f", rx=6, rot=20), R(335, 226, 30, 14, "#7fae4f", rx=6, rot=-15), R(370, 214, 30, 14, "#7fae4f", rx=6, rot=35)]
sh += [E(355, 262, 14, 14, "#e24b3a", s="#a6301f", sw=2), E(390, 258, 10, 10, "#e24b3a", s="#a6301f", sw=2)]
scene("falafel_box", CREAM, sh)


def wrap_scene(key, fill_a, fill_b, fill_c, bg):
    rng = random.Random(zlib.crc32(key.encode()) & 0xFFFF)
    sh = [shadow(240, 300, 170, 20, 0.14)]
    for (cx, cy, rot, cut) in ((165, 205, -18, False), (300, 175, -18, True)):
        sh += [R(cx - 95, cy - 38, 190, 76, "#e9d2a2", rx=36, s="#c3a56a", sw=3, rot=rot)]
        sh += [R(cx - 95, cy + 6, 190, 32, "#d7c186", rx=16, o=0.45, rot=rot), R(cx - 40, cy - 34, 110, 68, "#ffffff", o=0.45, rx=30, rot=rot)]
        sh += [L(cx - 60, cy - 28, cx + 78, cy + 8, "#c9a96a", 2.5, 0.8)] if not cut else []
        if cut:
            ex, ey = cx + 82 * math.cos(math.radians(rot)), cy + 82 * math.sin(math.radians(rot))
            sh += [E(ex, ey, 30, 40, "#f5e6c0", s="#c3a56a", sw=3, rot=rot), E(ex, ey, 22, 31, fill_a, rot=rot)]
            sh += scatter(rng, ex, ey, 17, 25, 9, lambda x, y, r: E(x, y, 5, 4.5, fill_b, rot=r.uniform(0, 180)))
            sh += scatter(rng, ex, ey, 14, 22, 5, lambda x, y, r: E(x, y, 5, 3, fill_c, rot=r.uniform(0, 180)))
    sh += [R(60, 252, 130, 22, "#f2f2ea", rx=8, s=LINE, sw=2, rot=-4, o=0.0)]
    scene(key, bg, sh)


wrap_scene("wrap_falafel", "#cfe6a0", "#7a4a1f", "#f7f2e4", MINT)
wrap_scene("wrap_halloumi", "#f7f2e4", "#f2c542", "#e24b3a", MINT)

# club sandwich
sh = [shadow(240, 308, 170, 20, 0.14)]
for (cx, cy, k) in ((175, 215, 1), (305, 190, -1)):
    top = [(cx - 100, cy + 55), (cx + 100, cy + 55), (cx + (60 if k > 0 else -60), cy - 55)]
    layers = [("#e8c98a", 0.0, "#c3a05a"), ("#6fb86a", 0.2, GREEN_D), ("#e24b3a", 0.4, "#a6301f"), ("#f0b8a0", 0.6, "#c98a70"), ("#e8c98a", 0.8, "#c3a05a")]
    for (col, t, st) in layers:
        y0, y1 = cy + 55 - t * 110, cy + 55 - (t + 0.2) * 110
        wl0, wl1 = 100 - t * 40 * (1 if k > 0 else 1), 100 - (t + 0.2) * 40
        sh += [poly([(cx - wl0, y0), (cx + wl0, y0), (cx + wl1 * (1 if True else 1), y1), (cx - wl1, y1)], col, st, 2.5)]
    sh += [L(cx, cy - 70, cx, cy - 25, "#a9722f", 3), E(cx, cy - 72, 7, 7, TOMATO)]
sh += [E(120, 280, 7, 7, "#6a3d6f"), E(360, 280, 7, 7, "#6a3d6f"), E(240, 290, 9, 9, "#f2c542")]
scene("club_sandwich", CREAM, sh)

# tuna salad box
rng = random.Random(12)
sh = [shadow(244, 306, 190, 22, 0.14), R(54, 60, 372, 236, "#e8f1f4", rx=22, s="#b9cdd4", sw=3), R(72, 78, 336, 200, "#fbfdfd", rx=14, s="#d4e2e6", sw=2)]
sh += scatter(rng, 240, 180, 150, 80, 22, lambda x, y, r: E(x, y, r.uniform(16, 26), r.uniform(11, 17), r.choice([GREEN, "#8bc46a", GREEN_D]), rot=r.uniform(0, 180)))
sh += [E(150, 190, 38, 26, "#d9b8a0", s="#a98a70", sw=2.5, rot=-10)] + [E(142, 182, 14, 8, "#ead0bc", o=0.9, rot=-10)]
for (x, y) in ((260, 150), (330, 205), (230, 235)):
    sh += [E(x, y, 22, 17, WHITE, s="#d8d2c2", sw=2), E(x, y, 9, 8, "#f5c542")]
sh += [E(300, 130, 11, 11, TOMATO, s="#a6301f", sw=2), E(190, 118, 11, 11, TOMATO, s="#a6301f", sw=2), E(350, 150, 11, 11, TOMATO, s="#a6301f", sw=2)]
sh += [E(280, 245, 5, 5, "#3a2a3a"), E(300, 255, 5, 5, "#3a2a3a")]
scene("tuna_salad", SKY, sh)

# greek salad
rng = random.Random(13)
sh = bowl_top(240, 182, 134, "#f4f1e6")
sh += scatter(rng, 240, 182, 100, 100, 7, lambda x, y, r: E(x, y, 26, 20, TOMATO, s="#a6301f", sw=2.5, rot=r.uniform(0, 180)))
sh += scatter(rng, 240, 182, 100, 100, 9, lambda x, y, r: E(x, y, 20, 10, "#a9d77a", s="#4f9f4a", sw=2, rot=r.uniform(0, 180)))
sh += scatter(rng, 240, 182, 104, 104, 9, lambda x, y, r: R(x - 10, y - 10, 20, 20, WHITE, rx=3, s="#d8d2c2", sw=2, rot=r.uniform(0, 90)))
sh += scatter(rng, 240, 182, 104, 104, 9, lambda x, y, r: E(x, y, 8, 6, "#5a2a5f", s="#3a1a3f", sw=1.5))
sh += scatter(rng, 240, 182, 100, 100, 6, lambda x, y, r: E(x, y, 22, 14, "none", s="#b04a8a", sw=3, rot=r.uniform(0, 180)))
sh += herbs(rng, 240, 182, 100, 100, 18, GREEN_D)
scene("greek_salad", MINT, sh)

# fruit cup
rng = random.Random(14)
cup = "M150 90 L330 90 L308 300 L172 300 Z"
sh = [shadow(240, 312, 120, 14, 0.16), P(cup, "#f1f8fa", "#b9cdd4", 3)]
cols = [("#e8505b", "#b9303b"), ("#f4a340", "#c97a1f"), ("#f7d94c", "#d9b52d"), ("#8bc46a", "#4f9f4a"), ("#8a4a9f", "#5a2a6f"), ("#7fb8e8", "#4a88b8")]
for _ in range(34):
    x, y = rng.uniform(172, 306), rng.uniform(110, 288)
    c, st = rng.choice(cols)
    if rng.random() < 0.5:
        sh += [R(x - 12, y - 12, 24, 24, c, rx=5, s=st, sw=2, rot=rng.uniform(0, 90))]
    else:
        sh += [E(x, y, 12, 12, c, s=st, sw=2)]
sh += [P(cup, None, "#b9cdd4", 3), P("M162 90 L318 90", None, "#ffffff", 4, 0.6), R(140, 74, 200, 22, "#dfeef2", rx=8, s="#b9cdd4", sw=3, o=0.9)]
sh += [R(354, 210, 70, 70, "#dfeef2", rx=35, s="#b9cdd4", sw=3, o=0.0)]
scene("fruit_cup", BUTTER, sh)

# hummus & pita
rng = random.Random(15)
sh = [shadow(240, 300, 180, 20, 0.12)]
sh += bowl_top(240, 175, 98, "#ead3a0")
sh += [E(240, 175, 62, 30, "#f6e8c4"), E(240, 175, 50, 22, "#ead3a0", o=0.8), E(240, 175, 26, 10, "#d9a24a", o=0.75)]
sh += scatter(rng, 240, 175, 56, 34, 10, lambda x, y, r: E(x, y, 3, 3, "#c9302f"))
sh += [E(215, 168, 9, 9, "#d9b46a", s="#b9923a", sw=1.5), E(262, 182, 9, 9, "#d9b46a", s="#b9923a", sw=1.5), E(240, 190, 9, 9, "#d9b46a", s="#b9923a", sw=1.5)]
for (x, y, rot) in ((100, 110, -30), (385, 110, 30), (95, 255, 25), (385, 255, -25), (240, 60, 0)):
    sh += [poly([(x - 48, y + 34), (x + 48, y + 34), (x, y - 40)], "#ecd2a0", "#c9a45f", 3) if False else R(x - 40, y - 26, 80, 52, "#ecd2a0", rx=24, s="#c9a45f", sw=3, rot=rot),
           R(x - 24, y - 12, 44, 14, "#f6e6c0", rx=7, o=0.8, rot=rot)]
sh += [R(60, 150, 70, 22, "#8fc45f", rx=10, rot=-10), R(350, 160, 70, 22, "#8fc45f", rx=10, rot=12)]
scene("hummus_pita", CREAM, sh)

# bread rolls on a board
rng = random.Random(16)
sh = wood_board()
for (x, y, rot) in ((120, 130, -15), (225, 120, 10), (330, 135, -8), (150, 225, 12), (260, 232, -10), (365, 225, 8)):
    sh += [E(x + 3, y + 7, 46, 33, "#7a4a1f", o=0.2, rot=rot), E(x, y, 46, 33, "#d99a4a", s="#a9672f", sw=3, rot=rot), E(x - 8, y - 9, 24, 11, "#f0c27a", o=0.85, rot=rot)]
    sh += [L(x - 22, y - 2, x - 6, y + 12, "#a9672f", 3), L(x - 4, y - 8, x + 12, y + 8, "#a9672f", 3), L(x + 14, y - 12, x + 28, y + 2, "#a9672f", 3)]
scene("bread_rolls", CREAM, sh)

# croissants
sh = wood_board(40, 80, 400, 220)


def croissant(cx, cy, rot, sc=1.0):
    out = []
    segs = ((-86, 8, 22, 14), (-56, -6, 30, 22), (-22, -12, 36, 28), (22, -12, 36, 28), (56, -6, 30, 22), (86, 8, 22, 14))
    for (dx, dy, rx, ry) in segs:
        out.append((dx, dy, rx, ry))
    sh_ = []
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for (dx, dy, rx, ry) in sorted(out, key=lambda s: -abs(s[0])):
        x, y = cx + (dx * cr - dy * sr) * sc, cy + (dx * sr + dy * cr) * sc
        sh_ += [E(x + 2, y + 5, rx * sc, ry * sc, "#7a4a1f", o=0.18, rot=rot), E(x, y, rx * sc, ry * sc, "#e0953a", s="#a9672f", sw=2.5, rot=rot), E(x - 3, y - 6 * sc, rx * sc * 0.6, ry * sc * 0.35, "#f3bf70", o=0.85, rot=rot)]
    return sh_


sh += croissant(150, 150, -10, 1.0) + croissant(330, 160, 12, 1.0) + croissant(240, 245, 0, 1.1)
scene("croissants", CREAM, sh)

# date & nut loaf
rng = random.Random(18)
sh = wood_board()
sh += [R(60, 100, 230, 120, "#6a3a1f", rx=30, s="#4a2810", sw=3), R(72, 108, 206, 36, "#8a5a33", rx=18, o=0.9)]
sh += scatter(rng, 175, 128, 90, 12, 8, lambda x, y, r: E(x, y, 6, 4, "#3a1a0a", rot=r.uniform(0, 90)))
for (x, y, rot) in ((340, 150, -8), (350, 235, 6)):
    sh += [R(x - 56, y - 44, 112, 88, "#c98a4b", rx=14, s="#6a3a1f", sw=3, rot=rot), R(x - 46, y - 34, 92, 68, "#d9a45f", rx=10, rot=rot)]
    sh += scatter(rng, x, y, 40, 28, 9, lambda a, b, r: E(a, b, 6, 4, "#4a2810", rot=r.uniform(0, 90)))
    sh += scatter(rng, x, y, 40, 28, 6, lambda a, b, r: E(a, b, 6, 3.4, "#f0d8a0", s="#b9923a", sw=1, rot=r.uniform(0, 90)))
scene("date_loaf", CREAM, sh)

# manakish
rng = random.Random(19)
sh = [shadow(244, 300, 140, 20, 0.14), E(240, 182, 138, 138, "#e0a85c", s="#b9763a", sw=3.5), E(240, 182, 112, 112, "#f6e2a0", s="#e0c070", sw=2)]
sh += scatter(rng, 240, 182, 100, 100, 16, lambda x, y, r: E(x, y, r.uniform(14, 24), r.uniform(9, 15), "#f8d968", o=0.9, rot=r.uniform(0, 180)))
sh += herbs(rng, 240, 182, 98, 98, 40, GREEN_D)
sh += [L(240, 70, 240, 294, "#c9a45f", 2.5, 0.7), L(128, 182, 352, 182, "#c9a45f", 2.5, 0.7), L(160, 102, 320, 262, "#c9a45f", 2, 0.5), L(320, 102, 160, 262, "#c9a45f", 2, 0.5)]
scene("manakish", CREAM, sh)

# samosas + chutney
rng = random.Random(20)
sh = [shadow(240, 308, 190, 20, 0.12)]
for (x, y, rot) in ((130, 140, -15), (250, 120, 12), (180, 240, 8), (300, 235, -10)):
    pts = [(x - 62, y + 48), (x + 62, y + 48), (x, y - 62)]
    sh += [poly([(a + 3, b + 6) for a, b in pts], "#7a4a1f", o=0.18), poly(pts, "#e0953a", "#a9672f", 3.5), poly([(x - 40, y + 40), (x + 40, y + 40), (x, y - 36)], "#f0b45f", o=0.8)]
    sh += [L(x - 62 + i * 8, y + 48, x - 56 + i * 8, y + 38, "#a9672f", 2) for i in range(14)]
sh += bowl_top(395, 285, 48, "#5fae4f") + [E(395, 285, 26, 14, "#7fc86a", o=0.9)]
scene("samosas", CREAM, sh)

# baklava tray
rng = random.Random(21)
sh = [shadow(244, 308, 190, 20, 0.14), R(50, 70, 380, 230, "#d9dbd6", rx=18, s="#a9aca5", sw=3), R(66, 86, 348, 198, "#e6c27a", rx=10, s="#b9923a", sw=2)]
for r_ in range(3):
    for c_ in range(5):
        x, y = 112 + c_ * 64 + (r_ % 2) * 32, 128 + r_ * 62
        sh += [poly([(x, y - 30), (x + 34, y), (x, y + 30), (x - 34, y)], "#e8a43c", "#a9672f", 2.5), poly([(x, y - 20), (x + 22, y), (x, y + 20), (x - 22, y)], "#f2c46a"),
               E(x, y, 6, 6, "#7fae4f", s="#4f8a3a", sw=1.5)]
scene("baklava", BUTTER, sh)

# pide
rng = random.Random(22)
boat = "M70 182 C110 110 370 110 410 182 C370 254 110 254 70 182 Z"
sh = [shadow(240, 300, 180, 18, 0.14), P(boat, "#e0a85c", "#a9672f", 3.5), P("M120 182 C160 142 320 142 360 182 C320 222 160 222 120 182 Z", "#f6e2a0", "#e0c070", 2)]
sh += scatter(rng, 240, 182, 110, 28, 9, lambda x, y, r: E(x, y, 9, 9, "#b8472f", s="#8a2f1f", sw=2))
sh += herbs(rng, 240, 182, 110, 28, 26, GREEN_D) + [E(300, 175, 16, 12, "#f5c542", s="#e0a53a", sw=2)]
scene("pide", CREAM, sh)


def cup_dessert(key, body, top, spec, bg):
    rng = random.Random(zlib.crc32(key.encode()) & 0xFFFF)
    sh = [shadow(240, 312, 150, 14, 0.14)]
    pot = "M110 170 C110 280 160 300 240 300 C320 300 370 280 370 170 Z"
    sh += [P(pot, body, "#00000022", 3), E(240, 170, 130, 36, top, s="#00000022", sw=2), E(240, 168, 112, 26, spec, o=0.5)]
    sh += scatter(rng, 240, 170, 100, 22, 14, lambda x, y, r: E(x, y, 6, 3.5, r.choice(["#f4dfb0", "#7fae4f", "#5a2c3a"]), rot=r.uniform(0, 180)))
    sh += [E(160, 235, 40, 18, WHITE, o=0.22, rot=-30)]
    scene(key, bg, sh)


cup_dessert("umm_ali", "#ffffff", "#d99a4a", "#f2c27a", BUTTER)
cup_dessert("rice_pudding", "#f4f8fa", "#fbf1d8", "#fffaf0", SKY)
sh = SCENES["rice_pudding"] + [E(240, 168, 60, 14, "#d9a24a", o=0.35), R(300, 60, 14, 100, "#c9cfd2", rx=6, rot=20), E(334, 160, 16, 8, "#c9cfd2", rot=20)]
SCENES["rice_pudding"] = sh

# yoghurt cups
sh = [shadow(240, 318, 190, 16, 0.14)]
for (x, col, band) in ((110, "#e8505b", "#f7c8cc"), (240, "#f4a340", "#fbe0b8"), (370, "#5a8fd9", "#c8dcf4")):
    cupp = f"M{x - 60} 130 L{x + 60} 130 L{x + 48} 296 L{x - 48} 296 Z"
    sh += [P(cupp, "#ffffff", "#d8d2c2", 3), P(f"M{x - 56} 190 L{x + 56} 190 L{x + 52} 252 L{x - 52} 252 Z", band), E(x, 221, 20, 18, col),
           E(x, 130, 60, 12, "#d9dde0", s="#b9bfc4", sw=2.5), E(x, 128, 46, 8, "#f1f3f4"), R(x - 8, 108, 16, 10, "#9aa2a8", rx=4)]
scene("yoghurt_cups", MINT, sh)

# cheesecake slice
rng = random.Random(24)
sh = [shadow(240, 300, 190, 22, 0.14), E(240, 250, 190, 40, WHITE, s=LINE, sw=3)]
wedge_front = [(110, 240), (370, 240), (370, 160), (110, 160)]
sh += [R(112, 196, 256, 54, "#9a6a3a", rx=10, s="#6e3a1f", sw=3), R(112, 150, 256, 52, "#fbe9b8", rx=6, s="#d9b86a", sw=3), E(240, 150, 128, 22, "#fff4d0", s="#d9b86a", sw=3)]
sh += [R(112, 196, 256, 8, "#e0c070", o=0.7)]
for (x, y) in ((160, 140), (240, 132), (320, 142), (275, 150), (200, 152)):
    sh += [E(x, y, 20, 17, "#e24b3a", s="#a6301f", sw=2.5), E(x - 5, y - 5, 6, 4, "#ff9a8a", o=0.9), P(f"M{x - 5} {y - 16} L{x} {y - 22} L{x + 5} {y - 16} Z", GREEN, GREEN_D, 1.5)]
scene("cheesecake", PINK_T if False else ROSE, sh)

# kunafa tray
rng = random.Random(25)
sh = [shadow(244, 308, 190, 20, 0.14), R(50, 70, 380, 230, "#d9dbd6", rx=18, s="#a9aca5", sw=3), R(66, 86, 348, 198, "#e8a43c", rx=10, s="#b9763a", sw=2.5)]
sh += [L(70 + i * 5, 90, 70 + i * 5 + 6, 280, "#c97a2a", 1.4, 0.5) for i in range(0, 68, 2)]
sh += [L(66 + i * 87, 86, 66 + i * 87, 284, "#8a4a1f", 2.5, 0.65) for i in range(1, 4)] + [L(66, 185, 414, 185, "#8a4a1f", 2.5, 0.65)]
sh += scatter(rng, 240, 185, 160, 85, 40, lambda x, y, r: E(x, y, 5, 3, "#7fae4f", rot=r.uniform(0, 180)))
sh += [E(150, 130, 60, 14, WHITE, o=0.16), E(310, 230, 70, 14, WHITE, o=0.12)]
scene("kunafa", BUTTER, sh)

# snack boxes
sh = [shadow(240, 318, 200, 16, 0.14)]
for (x, y, col) in ((120, 150, "#e8505b"), (245, 130, "#58a853"), (370, 155, "#5a8fd9")):
    sh += [R(x - 56, y - 50, 112, 132, KRAFT, rx=10, s=KRAFT_D, sw=3), R(x - 40, y - 30, 80, 60, "#f7f0e0", rx=6, s=KRAFT_D, sw=2), R(x - 56, y + 40, 112, 28, col, rx=6)]
    sh += [E(x - 18, y - 6, 12, 12, "#d99a4a", s="#a9672f", sw=1.5), E(x + 16, y - 10, 10, 10, "#7a4a1f"), R(x - 6, y + 6, 28, 12, "#f2c542", rx=4, rot=-20)]
scene("snack_boxes", CREAM, sh)

# granola bars
sh = [shadow(240, 318, 190, 16, 0.14)]
for (x, y, col, rot) in ((130, 120, "#58a853", -8), (330, 125, "#e0953a", 6), (150, 230, "#8a4a9f", 5), (340, 235, "#e8505b", -6)):
    sh += [R(x - 78, y - 30, 156, 60, col, rx=12, s="#00000030", sw=2.5, rot=rot), R(x - 62, y - 14, 80, 26, "#ffffff", rx=8, o=0.75, rot=rot)]
    sh += [E(x + 52, y, 14, 14, "#f2d08a", s="#c9a45f", sw=2, rot=rot), L(x - 78, y - 20, x - 78, y + 20, "#00000030", 3, 0.8)]
scene("granola_bars", MINT, sh)

# crackers & cheese
rng = random.Random(28)
sh = wood_board(40, 70, 400, 230)
for i in range(3):
    for j in range(4):
        x, y = 100 + j * 82, 115 + i * 68
        sh += [R(x - 30, y - 26, 60, 52, "#e0b86a", rx=8, s="#b9923a", sw=2.5, rot=rng.uniform(-8, 8))] + scatter(rng, x, y, 18, 15, 5, lambda a, b, r: E(a, b, 2.4, 2.4, "#a9772f"))
for (x, y, rot) in ((175, 215, -10), (270, 235, 8), (360, 210, -4)):
    sh += [R(x - 34, y - 28, 68, 56, "#f8c84a", rx=6, s="#d9a53a", sw=2.5, rot=rot), E(x - 12, y - 8, 4, 4, "#d9a53a", rot=rot), E(x + 12, y + 8, 5, 5, "#d9a53a")]
scene("crackers_cheese", CREAM, sh)

# date box
rng = random.Random(30)
sh = [shadow(240, 316, 190, 18, 0.14), R(60, 80, 360, 220, KRAFT, rx=16, s=KRAFT_D, sw=3), R(76, 96, 328, 188, "#4a2810", rx=10)]
for i in range(5):
    for j in range(8):
        x, y = 108 + j * 35 + (i % 2) * 12, 122 + i * 36
        sh += [E(x, y, 20, 14, "#6a3a1f", s="#3a1a0a", sw=2, rot=rng.uniform(-30, 30)), E(x - 5, y - 4, 8, 3.5, "#a8713a", o=0.8)]
sh += [R(300, 36, 150, 70, "#58a853", rx=10, s=GREEN_D, sw=3, rot=8, o=0.0)]
scene("date_boxes", CREAM, sh)

# bananas & apples
rng = random.Random(31)
sh = [shadow(240, 312, 190, 18, 0.12)]
for (x, y, col, st) in ((120, 235, "#e24b3a", "#a6301f"), (190, 255, "#8bc46a", "#4f9f4a"), (400, 245, "#e24b3a", "#a6301f")):
    sh += [E(x, y, 48, 44, col, s=st, sw=3), E(x - 14, y - 14, 16, 9, WHITE, o=0.35, rot=-30), L(x, y - 42, x + 4, y - 58, "#5a3a1f", 4), E(x + 14, y - 54, 16, 7, GREEN, s=GREEN_D, sw=2, rot=-20)]
for i, (bx, by, rot) in enumerate(((250, 150, -25), (280, 165, -15), (310, 175, -5))):
    sh += [P(f"M{bx - 110} {by + 40} C{bx - 60} {by + 110} {bx + 60} {by + 100} {bx + 100} {by - 10} C{bx + 70} {by + 50} {bx - 50} {by + 60} {bx - 110} {by + 40} Z", "#f7d94c", "#c9a52d", 3)]
    break
sh += [P("M140 190 C190 270 330 270 390 160 C340 230 200 240 140 190 Z", "#fbe97e", "#c9a52d", 3), P("M150 175 C200 245 320 245 380 150 C335 215 205 225 150 175 Z", "#f7d94c", "#c9a52d", 3), E(145, 188, 8, 6, "#5a3a1f"), E(386, 156, 8, 6, "#5a3a1f")]
scene("bananas_apples", CREAM, sh)

# oranges & mandarins
rng = random.Random(32)
sh = [shadow(240, 316, 190, 18, 0.12)]
for (x, y, r, col) in ((150, 190, 62, "#f08a2c"), (290, 175, 66, "#f39a3a"), (230, 260, 58, "#f08a2c"), (385, 250, 44, "#f7a94a"), (370, 130, 40, "#f7a94a")):
    sh += [E(x, y, r, r, col, s="#c9661a", sw=3), E(x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.18, WHITE, o=0.35, rot=-30)]
    sh += scatter(rng, x, y, r * 0.8, r * 0.8, 10, lambda a, b, rr: E(a, b, 1.8, 1.8, "#c9661a", o=0.6)) + [E(x, y - r + 6, 6, 4, GREEN_D)]
sh += [E(100, 85, 44, 44, "#fbd38a", s="#c9661a", sw=3), E(100, 85, 34, 34, "#f6b04a")] + [L(100, 85, 100 + 34 * math.cos(math.radians(a)), 85 + 34 * math.sin(math.radians(a)), "#fbe2b0", 2.5) for a in range(0, 360, 45)]
sh += [E(310, 82, 22, 12, GREEN, s=GREEN_D, sw=2, rot=-25), E(335, 92, 18, 10, GREEN, s=GREEN_D, sw=2, rot=15)]
scene("oranges", PEACH, sh)

# tomatoes & cucumbers
rng = random.Random(33)
sh = [shadow(240, 316, 190, 18, 0.12)]
for (x, y, rot) in ((190, 105, -8), (270, 130, 6)):
    sh += [R(x - 130, y - 28, 260, 56, "#4f9f4a", rx=28, s=GREEN_D, sw=3, rot=rot), R(x - 112, y - 18, 220, 14, "#8bc46a", rx=7, o=0.7, rot=rot)]
for (x, y) in ((110, 235), (210, 258), (310, 232), (395, 262)):
    sh += [E(x, y, 48, 42, TOMATO, s="#a6301f", sw=3), E(x - 14, y - 14, 15, 8, WHITE, o=0.4, rot=-30)]
    sh += [P(f"M{x - 20} {y - 38} L{x - 6} {y - 28} L{x} {y - 46} L{x + 6} {y - 28} L{x + 20} {y - 38} L{x + 12} {y - 24} L{x + 22} {y - 18} L{x - 22} {y - 18} L{x - 12} {y - 24} Z", GREEN, GREEN_D, 2)]
scene("tomato_cucumber", MINT, sh)


def bottle(x, y, body, cap, label, wide=62, tall=250):
    top = y - tall // 2
    return [R(x - wide / 2, top + 54, wide, tall - 54, body, rx=14, s="#00000030", sw=3), R(x - wide / 3, top + 18, wide * 2 / 3, 50, body, s="#00000030", sw=3, rx=8),
            R(x - wide / 3 - 2, top, wide * 2 / 3 + 4, 22, cap, rx=6, s="#00000030", sw=2.5), R(x - wide / 2 + 2, top + 110, wide - 4, 54, label, rx=4),
            R(x - wide / 2 + 8, top + 66, 8, 120, WHITE, rx=4, o=0.35)]


sh = [shadow(240, 330, 190, 14, 0.14)]
sh += bottle(130, 190, "#f08a2c", "#2f7a3a", "#fff3d0") + bottle(240, 190, "#7fc86a", "#e8505b", "#f4fbe8") + bottle(350, 190, "#c9302f", "#2a1a10", "#ffe8e8")
scene("juice_bottles", PEACH, sh)
sh = [shadow(240, 330, 190, 14, 0.14)]
for x in (130, 240, 350):
    sh += bottle(x, 190, "#b9dcf2", "#ffffff", "#2a7fc9")
    sh += [L(x - 20, 150 + i * 16, x + 20, 150 + i * 16, "#ffffff", 2, 0.5) for i in range(3)]
scene("water_bottles", SKY, sh)
sh = [shadow(240, 330, 190, 14, 0.14)]
for (x, col) in ((120, "#e0953a"), (240, "#58a853"), (360, "#e8505b")):
    sh += [R(x - 46, 80, 92, 230, col, rx=14, s="#00000030", sw=3), E(x, 82, 46, 10, "#d9dde0", s="#b9bfc4", sw=2.5), E(x, 306, 46, 10, "#d9dde0", o=0.0),
           R(x - 46, 150, 92, 80, "#ffffff", o=0.9), E(x, 190, 22, 22, col), R(x - 34, 92, 10, 200, WHITE, rx=5, o=0.3), E(x, 82, 18, 5, "#9aa2a8")]
scene("iced_tea", MINT, sh)

# raw chicken (declined items)
rng = random.Random(40)
sh = [shadow(244, 312, 190, 20, 0.14), R(50, 70, 380, 235, "#f2f6f7", rx=18, s="#c5d3d8", sw=3), R(64, 84, 352, 207, "#ffffff", rx=12, s="#e0e8ea", sw=2)]
for (x, y, rot) in ((140, 150, -20), (250, 135, 15), (350, 165, -5), (180, 235, 10), (300, 240, -15)):
    sh += [E(x, y, 46, 30, "#f2a8a0", s="#c9756a", sw=3, rot=rot), E(x - 8, y - 8, 22, 9, "#fbd0c8", o=0.9, rot=rot)]
sh += [R(58, 160, 364, 70, "#ffffff", o=0.28, rx=10, rot=-6)]
scene("raw_chicken", ROSE, sh)
# raw salmon
sh = [shadow(244, 312, 190, 20, 0.14), R(50, 70, 380, 235, "#f2f6f7", rx=18, s="#c5d3d8", sw=3), R(64, 84, 352, 207, "#ffffff", rx=12, s="#e0e8ea", sw=2)]
for (x, y, rot) in ((170, 150, -10), (310, 150, 8), (240, 235, 0)):
    sh += [R(x - 74, y - 34, 148, 68, "#f58a5c", rx=30, s="#c9552f", sw=3, rot=rot)]
    sh += [L(x - 56 + i * 24, y - 22, x - 40 + i * 24, y + 24, "#fbd3b8", 4, 0.85) for i in range(5)] + [R(x - 60, y - 24, 120, 10, "#ffb08a", rx=5, o=0.8, rot=rot)]
scene("raw_salmon", ROSE, sh)
# returned plates
rng = random.Random(41)
sh = [shadow(244, 312, 170, 20, 0.14)]
for (x, y, r) in ((170, 160, 108), (310, 200, 108)):
    sh += [E(x, y, r, r * 0.95, WHITE, s=LINE, sw=3), E(x, y, r * 0.78, r * 0.74, "#f1efe8", s="#e0ddd0", sw=2)]
    sh += scatter(rng, x, y, r * 0.5, r * 0.45, 9, lambda a, b, rr: E(a, b, rr.uniform(8, 18), rr.uniform(6, 11), rr.choice(["#b9823a", "#e0c070", "#7aa84a", "#c9605a"]), o=0.9, rot=rr.uniform(0, 180)))
    sh += [E(x + 30, y + 30, 22, 12, "#d9a33a", o=0.5, rot=20)]
sh += [L(80, 290, 150, 250, "#b9bfc4", 5), E(396, 120, 10, 8, "#b9bfc4")]
scene("plate_leftovers", "#eceae4", sh)
# unlabelled container
sh = [shadow(240, 318, 140, 16, 0.14), R(110, 120, 260, 180, "#f4f6f7", rx=18, s="#c5d3d8", sw=3), R(100, 98, 280, 40, "#e3eaec", rx=12, s="#c5d3d8", sw=3), R(124, 150, 232, 130, "#ffffff", rx=10, s="#e0e8ea", sw=2, o=0.7)]
sh += [P("M222 206 C222 178 258 178 258 204 C258 222 240 222 240 240", None, "#9aa8ad", 7), E(240, 262, 5, 5, "#9aa8ad")]
scene("unlabelled", "#eceae4", sh)

ORDER = sorted(SCENES)


# ------------------------------------------------------------------ preview renderer (PIL)
def render(shapes, scale=3):
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W * scale, H * scale), (255, 255, 255, 255))

    def rgb(c):
        c = c.lstrip("#")
        if len(c) == 8:
            return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4, 6))
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

    def rotate(pts, cx, cy, deg):
        if not deg:
            return pts
        a = math.radians(deg)
        ca, sa = math.cos(a), math.sin(a)
        return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]

    def ell(cx, cy, rx, ry, rot):
        return rotate([(cx + rx * math.cos(2 * math.pi * i / 72), cy + ry * math.sin(2 * math.pi * i / 72)) for i in range(72)], cx, cy, rot)

    def rrect(x, y, w, h, rx, rot):
        rx = min(rx, w / 2, h / 2)
        pts = []
        for (ccx, ccy, a0) in ((x + w - rx, y + rx, -90), (x + w - rx, y + h - rx, 0), (x + rx, y + h - rx, 90), (x + rx, y + rx, 180)):
            n = 8 if rx > 0 else 1
            for k in range(n + 1):
                a = math.radians(a0 + 90 * k / n)
                pts.append((ccx + rx * math.cos(a), ccy + rx * math.sin(a)))
        return rotate(pts, x + w / 2, y + h / 2, rot)

    def flat(d):
        toks = re.findall(r"[MLCQZ]|-?\d+\.?\d*", d)
        polys, cur, i, last = [], [], 0, (0, 0)
        while i < len(toks):
            t = toks[i]
            if t == "M":
                if cur: polys.append(cur)
                last = (float(toks[i + 1]), float(toks[i + 2])); cur = [last]; i += 3
            elif t == "L":
                last = (float(toks[i + 1]), float(toks[i + 2])); cur.append(last); i += 3
            elif t == "C":
                x1, y1, x2, y2, x3, y3 = (float(v) for v in toks[i + 1:i + 7])
                x0, y0 = last
                for k in range(1, 17):
                    u = k / 16
                    cur.append(((1 - u) ** 3 * x0 + 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3 * x3,
                                (1 - u) ** 3 * y0 + 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3 * y3))
                last = (x3, y3); i += 7
            elif t == "Q":
                x1, y1, x2, y2 = (float(v) for v in toks[i + 1:i + 5])
                x0, y0 = last
                for k in range(1, 13):
                    u = k / 12
                    cur.append(((1 - u) ** 2 * x0 + 2 * (1 - u) * u * x1 + u * u * x2, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * y1 + u * u * y2))
                last = (x2, y2); i += 5
            elif t == "Z":
                i += 1
            else:
                i += 1
        if cur: polys.append(cur)
        return polys

    for sh in shapes:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        o = sh.get("o", 1)
        f, s, sw = sh.get("f"), sh.get("s"), sh.get("sw", 0)
        t = sh["t"]
        polys = []
        if t == "r":
            polys = [rrect(sh["x"], sh["y"], sh["w"], sh["h"], sh.get("rx", 0), sh.get("rot", 0))]
        elif t == "e":
            polys = [ell(sh["cx"], sh["cy"], sh["rx"], sh["ry"], sh.get("rot", 0))]
        elif t == "p":
            polys = flat(sh["d"])
        elif t == "l":
            pts = [(sh["x1"] * scale, sh["y1"] * scale), (sh["x2"] * scale, sh["y2"] * scale)]
            c = rgb(sh["s"]); c = c[:3] + (int(c[3] * o),)
            d.line(pts, fill=c, width=max(1, int(sh["sw"] * scale)))
            img = Image.alpha_composite(img, layer)
            continue
        for pl in polys:
            pts = [(x * scale, y * scale) for x, y in pl]
            if len(pts) < 2:
                continue
            if f and f != "none":
                c = rgb(f); d.polygon(pts, fill=c[:3] + (int(c[3] * o),))
            if s and sw:
                c = rgb(s); d.line(pts + [pts[0]], fill=c[:3] + (int(c[3] * o),), width=max(1, int(sw * scale)), joint="curve")
        img = Image.alpha_composite(img, layer)
    return img.resize((W, H), Image.LANCZOS).convert("RGB")


def main():
    out = {k: SCENES[k] for k in ORDER}
    path = os.path.join(ROOT, "src", "data", "foodScenes.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(len(out), "scenes,", os.path.getsize(path), "bytes ->", path)
    if "--preview" in sys.argv:
        from PIL import Image
        d = sys.argv[sys.argv.index("--preview") + 1]
        os.makedirs(d, exist_ok=True)
        per = 12
        for sheet, start in enumerate(range(0, len(ORDER), per)):
            keys = ORDER[start:start + per]
            cols = 4
            rows = (len(keys) + cols - 1) // cols
            tile = (360, 270)
            sh_img = Image.new("RGB", (cols * tile[0], rows * (tile[1] + 22)), (255, 255, 255))
            from PIL import ImageDraw
            dr = ImageDraw.Draw(sh_img)
            for i, k in enumerate(keys):
                im = render(SCENES[k]).resize(tile, Image.LANCZOS)
                x, y = (i % cols) * tile[0], (i // cols) * (tile[1] + 22)
                sh_img.paste(im, (x, y + 22))
                dr.text((x + 6, y + 4), k, fill=(0, 0, 0))
            sh_img.save(os.path.join(d, f"sheet{sheet + 1}.png"))
        print("previews in", d)


if __name__ == "__main__":
    main()
