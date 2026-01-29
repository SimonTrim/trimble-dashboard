/**
 * Script d'injection du Dashboard Trimble Connect
 * À copier-coller dans la console développeur de Trimble Connect
 * 
 * Usage:
 * 1. Ouvrez Trimble Connect (app.connect.trimble.com)
 * 2. Ouvrez un projet
 * 3. Appuyez sur F12 pour ouvrir la console
 * 4. Copiez-collez ce script complet et appuyez sur Entrée
 */

(function() {
  console.log('%c🚀 Chargement du Dashboard Trimble Connect...', 'color: #005F9E; font-size: 16px; font-weight: bold;');
  
  // Vérifier si le dashboard est déjà chargé
  if (document.getElementById('trimble-dashboard-container')) {
    console.warn('⚠️ Dashboard déjà chargé. Rechargement...');
    document.getElementById('trimble-dashboard-container').remove();
  }
  
  // Créer le conteneur principal
  const container = document.createElement('div');
  container.id = 'trimble-dashboard-container';
  container.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    width: 450px;
    max-height: calc(100vh - 80px);
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 10000;
    overflow: hidden;
    font-family: 'Roboto', sans-serif;
  `;
  
  // Header du dashboard
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #005F9E 0%, #00A3E0 100%);
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  `;
  header.innerHTML = `
    <div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 500;">📊 Dashboard</h3>
      <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">Trimble Connect</p>
    </div>
    <button id="close-dashboard" style="
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      transition: background 0.2s;
    ">×</button>
  `;
  
  // Conteneur du contenu
  const content = document.createElement('div');
  content.id = 'app';
  content.style.cssText = `
    padding: 20px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  `;
  content.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="
        border: 4px solid #f3f3f3;
        border-top: 4px solid #005F9E;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
      "></div>
      <p style="margin-top: 20px; color: #005F9E; font-size: 14px;">Chargement des données...</p>
    </div>
  `;
  
  // Ajouter l'animation de rotation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  // Assembler le dashboard
  container.appendChild(header);
  container.appendChild(content);
  document.body.appendChild(container);
  
  // Bouton de fermeture
  document.getElementById('close-dashboard').addEventListener('click', function() {
    container.remove();
    console.log('✅ Dashboard fermé');
  });
  
  // Rendre le header draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  
  header.addEventListener('mousedown', function(e) {
    if (e.target.id === 'close-dashboard') return;
    isDragging = true;
    initialX = e.clientX - container.offsetLeft;
    initialY = e.clientY - container.offsetTop;
  });
  
  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      container.style.left = currentX + 'px';
      container.style.top = currentY + 'px';
      container.style.right = 'auto';
    }
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
  
  // Charger les polices Google Fonts
  if (!document.getElementById('google-fonts-roboto')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'google-fonts-roboto';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    document.head.appendChild(fontLink);
  }
  
  // Charger le script principal du dashboard
  const script = document.createElement('script');
  script.src = 'https://simontrim.github.io/trimble-dashboard/dist/index.js';
  script.onload = function() {
    console.log('%c✅ Dashboard chargé avec succès!', 'color: #28A745; font-size: 14px; font-weight: bold;');
    console.log('%cℹ️ Le dashboard devrait s\'afficher dans un panneau sur le côté droit.', 'color: #00A3E0;');
  };
  script.onerror = function() {
    console.error('❌ Erreur de chargement du dashboard');
    content.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #DC3545;">
        <h4 style="margin: 0 0 10px 0;">❌ Erreur de chargement</h4>
        <p style="margin: 0; font-size: 14px;">Impossible de charger le dashboard.</p>
        <p style="margin: 10px 0 0 0; font-size: 12px;">Vérifiez votre connexion internet.</p>
      </div>
    `;
  };
  document.body.appendChild(script);
  
  console.log('%c📍 Emplacement: Panneau sur la droite', 'color: #00A3E0;');
  console.log('%c💡 Astuce: Vous pouvez déplacer le panneau en cliquant sur l\'en-tête', 'color: #FFC107;');
})();
