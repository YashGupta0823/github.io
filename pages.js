const root=document.documentElement,themeButton=document.querySelector('.theme-toggle'),menuButton=document.querySelector('.menu-button'),navLinks=document.querySelector('.nav-links');
const savedTheme=localStorage.getItem('portfolio-theme');
if(savedTheme)root.dataset.theme=savedTheme;else if(matchMedia('(prefers-color-scheme: dark)').matches)root.dataset.theme='dark';
function updateTheme(){themeButton.setAttribute('aria-label',`Switch to ${root.dataset.theme==='dark'?'light':'dark'} theme`);document.querySelector('meta[name="theme-color"]').content=root.dataset.theme==='dark'?'#0a0908':'#eae0d5'}
updateTheme();themeButton.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('portfolio-theme',root.dataset.theme);updateTheme()});
menuButton.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuButton.setAttribute('aria-expanded',open);menuButton.setAttribute('aria-label',open?'Close menu':'Open menu')});
document.querySelector('#year').textContent=new Date().getFullYear();
