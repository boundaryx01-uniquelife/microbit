# Simple flat drawings for print cards (supersampled, transparent PNG)
from PIL import Image, ImageDraw
import math
S=4; N=600
def new(): 
    im=Image.new('RGBA',(N*S,N*S),(0,0,0,0)); return im,ImageDraw.Draw(im)
def save(im,name): im.resize((N,N),Image.LANCZOS).save('img/'+name+'.png')
def sc(*a): return [x*S for x in a]
def circle(name,col):
    im,d=new(); d.ellipse(sc(10,10,590,590),fill=col); save(im,name)
for n,c in [('red','#E5484D'),('yellow','#F2B300'),('green','#1FA463'),('orange','#F08A24'),('blue','#2456E5')]: circle('c_'+n,c)
INK='#111827'
# peanut
im,d=new()
for (x0,y0,x1,y1) in [(60,200,330,420),(270,200,540,420)]:
    d.ellipse(sc(x0,y0,x1,y1),fill='#D9A55B',outline=INK,width=10*S)
d.ellipse(sc(255,230,345,390),fill='#D9A55B')
for p in [(150,280),(190,340),(420,280),(460,340),(130,330),(480,290)]: d.ellipse(sc(p[0]-9,p[1]-9,p[0]+9,p[1]+9),fill='#A8742F')
d.rectangle(sc(262,240,338,260),fill='#D9A55B'); save(im,'peanut')
# milk
im,d=new()
d.polygon(sc(170,200,430,200,430,540,170,540),fill='white',outline=INK)
d.rectangle(sc(170,200,430,540),fill='white',outline=INK,width=10*S)
d.polygon(sc(170,200,300,90,430,200),fill='#9DB7F5',outline=INK)
d.line(sc(170,200,300,90,430,200,170,200),fill=INK,width=10*S)
d.rectangle(sc(210,300,390,430),fill='#2456E5')
d.ellipse(sc(265,325,335,395),fill='white'); save(im,'milk')
# rice bowl
im,d=new()
d.pieslice(sc(110,160,490,440),180,360,fill='white',outline=INK,width=10*S)
d.pieslice(sc(100,240,500,560),0,180,fill='#E5484D',outline=INK,width=10*S)
d.rectangle(sc(220,520,380,555),fill='#E5484D',outline=INK,width=8*S); save(im,'rice')
# apple
im,d=new()
d.ellipse(sc(110,170,300,520),fill='#E5484D'); d.ellipse(sc(300,170,490,520),fill='#E5484D')
d.ellipse(sc(130,150,470,540),fill='#E5484D')
d.line(sc(300,170,320,90),fill='#6B4423',width=18*S)
d.polygon(sc(330,120,430,70,410,150),fill='#1FA463'); save(im,'apple')
# pencil case
im,d=new()
d.rounded_rectangle(sc(60,200,540,420),radius=70*S,fill='#2456E5',outline=INK,width=10*S)
d.line(sc(110,310,490,310),fill='white',width=8*S)
d.ellipse(sc(280,285,320,335),fill='#F2B300',outline=INK,width=6*S); save(im,'case')
# badge
im,d=new()
d.ellipse(sc(100,100,500,500),fill='#F2B300',outline=INK,width=12*S)
pts=[]
for i in range(10):
    r=130 if i%2==0 else 55; a=-math.pi/2+i*math.pi/5; pts.append((300+r*math.cos(a),300+r*math.sin(a)))
d.polygon([(x*S,y*S) for x,y in pts],fill='white'); save(im,'badge')
# hand open
im,d=new()
d.rounded_rectangle(sc(180,280,420,520),radius=60*S,fill='#F3C9A5',outline=INK,width=10*S)
for i,(x,h) in enumerate([(160,170),(230,110),(300,90),(370,110)]):
    d.rounded_rectangle(sc(x,h+20,x+55,330),radius=27*S,fill='#F3C9A5',outline=INK,width=10*S)
d.rounded_rectangle(sc(110,300,200,400),radius=40*S,fill='#F3C9A5'); 
d.rounded_rectangle(sc(110,320,230,380),radius=30*S,fill='#F3C9A5',outline=INK,width=10*S)
d.rounded_rectangle(sc(185,285,415,515),radius=55*S,fill='#F3C9A5'); save(im,'hand_open')
# fist
im,d=new()
d.rounded_rectangle(sc(150,200,450,500),radius=90*S,fill='#F3C9A5',outline=INK,width=10*S)
for x in (180,245,310,375): d.line(sc(x,200,x,300),fill=INK,width=8*S)
d.rounded_rectangle(sc(130,330,300,420),radius=40*S,fill='#F3C9A5',outline=INK,width=10*S); save(im,'fist')
# clock
im,d=new()
d.ellipse(sc(100,100,500,500),fill='white',outline=INK,width=14*S)
for i in range(12):
    a=i*math.pi/6; d.line(sc(300+170*math.sin(a),300-170*math.cos(a),300+195*math.sin(a),300-195*math.cos(a)),fill=INK,width=8*S)
d.line(sc(300,300,300,170),fill=INK,width=14*S); d.line(sc(300,300,390,340),fill='#E5484D',width=14*S)
d.ellipse(sc(285,285,315,315),fill=INK); save(im,'clock')
# stop square
im,d=new(); d.rectangle(sc(130,130,470,470),fill='#E5484D'); save(im,'i_stop')
# power
im,d=new()
d.arc(sc(110,130,490,510),-60,240,fill='#1FA463',width=44*S); d.line(sc(300,70,300,300),fill='#1FA463',width=44*S); save(im,'i_power')
# button (orange circle with X eyes hint)
im,d=new(); d.ellipse(sc(90,90,510,510),fill='#F08A24'); d.ellipse(sc(190,190,410,410),fill='#FFD7A8'); save(im,'i_button')
