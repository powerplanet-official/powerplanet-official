"""Recreate the supplied Power Planet reference as self-contained SVG paths.
Build-time only: requires fonttools and Liberation fonts. Runtime uses the saved SVG.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from pathlib import Path
import math

def lettering(text,font,x,y,width,height,color,spacing=0):
    ft=TTFont(font);glyphs=ft.getGlyphSet();cmap=ft.getBestCmap();metrics=ft['hmtx'].metrics
    pen=SVGPathPen(glyphs);bounds=BoundsPen(glyphs);advance=0
    for char in text:
        name=cmap[ord(char)];glyph=glyphs[name]
        glyph.draw(TransformPen(pen,(1,0,0,1,advance,0)))
        glyph.draw(TransformPen(bounds,(1,0,0,1,advance,0)))
        advance+=metrics[name][0]+spacing
    left,bottom,right,top=bounds.bounds
    sx=width/(right-left);sy=height/(top-bottom)
    return f'<path fill="{color}" transform="matrix({sx:.7f} 0 0 {-sy:.7f} {x-left*sx:.5f} {y+bottom*sy:.5f})" d="{pen.getCommands()}"/>'
base='/usr/share/fonts/truetype/liberation/'
parts=[lettering('P',base+'LiberationSans-Bold.ttf',16,218,144,173,'#95bf3b'),lettering('OWER',base+'LiberationSans-Bold.ttf',163,218,552,126,'#95bf3b'),lettering('Planet',base+'LiberationSans-BoldItalic.ttf',175,333,425,103,'#050505'),lettering('(Pvt)Ltd.',base+'LiberationSans-BoldItalic.ttf',601,328,140,30,'#050505'),lettering('The Power you Own',base+'LiberationSerif-BoldItalic.ttf',22,389,719,48,'#c8242c',spacing=230)]
# Lightning over the O, with layered gold faces matching the reference.
parts+=['<path d="M306 33 237 70 201 132 224 130 165 250 274 117 246 117Z" fill="#eda925"/>','<path d="M299 42 244 81 211 125 237 121 178 231 264 124 237 124Z" fill="url(#bolt)"/>','<path d="m244 81 55-39-58 82-16 5 13-40Z" fill="#ffdd20"/>']
rays=[]
for i in range(39):
    angle=math.radians(-100-i*5);radius=181 if i%2==0 else 128
    rays.append(f'{885+math.cos(angle)*radius:.2f},{176+math.sin(angle)*radius:.2f}')
parts+=['<g clip-path="url(#sunHalf)"><polygon points="885,176 '+' '.join(rays)+'" fill="url(#sun)"/><circle cx="885" cy="176" r="132" fill="url(#sun)"/></g>', '<g clip-path="url(#solarSide)"><circle cx="897" cy="193" r="133" fill="#95bf3b"/>', '<g clip-path="url(#solarDisc)" fill="none" stroke="#fff" stroke-width="5"><path d="M849 49 822 328M912 52 917 331M968 80 1012 287M775 129 1024 150M767 213 1028 227M799 279 996 293"/></g></g>', '<path d="M992 3 803 235 855 234 766 353 992 126 917 126Z" fill="#fff" stroke="#e0e8e1" stroke-width="1.1"/>']
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 415" role="img" aria-labelledby="logo-title logo-description">
<title id="logo-title">Power Planet (Pvt) Ltd.</title><desc id="logo-description">The Power you Own. Green Power lettering with a gold lightning bolt, black Planet lettering, a red tagline and a sun and solar-panel emblem.</desc>
<defs><linearGradient id="bolt" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff324"/><stop offset=".5" stop-color="#ffc414"/><stop offset="1" stop-color="#f48b20"/></linearGradient><linearGradient id="sun" x1=".7" y1="0" x2=".2" y2="1"><stop stop-color="#fff31a"/><stop offset=".5" stop-color="#ffd21b"/><stop offset="1" stop-color="#f59a24"/></linearGradient><clipPath id="sunHalf"><path d="M680 0H993L798 235 850 235 755 365H680Z"/></clipPath><clipPath id="solarSide"><path d="M995 0H1050V370H755Z"/></clipPath><clipPath id="solarDisc"><circle cx="897" cy="193" r="133"/></clipPath></defs>
'''+'<rect width="1050" height="415" fill="white"/>'+''.join(parts)+'\n</svg>\n'
Path('public/images/powerplanet-logo.svg').write_text(svg)
