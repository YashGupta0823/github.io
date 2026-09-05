const root=document.documentElement,themeButton=document.querySelector('.theme-toggle'),menuButton=document.querySelector('.menu-button'),navLinks=document.querySelector('.nav-links');
const savedTheme=localStorage.getItem('portfolio-theme');
if(savedTheme)root.dataset.theme=savedTheme;else if(matchMedia('(prefers-color-scheme: dark)').matches)root.dataset.theme='dark';
function updateTheme(){themeButton.setAttribute('aria-label',`Switch to ${root.dataset.theme==='dark'?'light':'dark'} theme`);document.querySelector('meta[name="theme-color"]').content=root.dataset.theme==='dark'?'#0a0908':'#eae0d5'}
updateTheme();themeButton.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('portfolio-theme',root.dataset.theme);updateTheme()});
menuButton.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuButton.setAttribute('aria-expanded',open);menuButton.setAttribute('aria-label',open?'Close menu':'Open menu')});
document.querySelector('#year').textContent=new Date().getFullYear();

if(!matchMedia('(pointer: coarse)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  const glow=document.createElement('div');
  glow.className='cursor-glow';
  document.body.appendChild(glow);
  let gx=0,gy=0,raf=null;
  const move=()=>{glow.style.transform=`translate3d(${gx}px, ${gy}px, 0) translate(-50%, -50%)`;raf=null};
  addEventListener('pointermove',e=>{gx=e.clientX;gy=e.clientY;glow.classList.add('active');if(!raf)raf=requestAnimationFrame(move)},{passive:true});
  addEventListener('mouseleave',()=>glow.classList.remove('active'));
}
