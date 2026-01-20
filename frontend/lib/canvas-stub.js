// Stub para o módulo canvas do Node.js no cliente
// Este arquivo substitui o módulo 'canvas' (pacote npm do Node.js) durante o build do cliente
// 
// IMPORTANTE: No navegador, usamos a API Canvas NATIVA do navegador (HTMLCanvasElement),
// não o módulo 'canvas' do Node.js. O módulo 'canvas' do Node.js é apenas para uso no servidor.
// 
// O Fabric.js no navegador usa document.createElement('canvas'), que é a API nativa do navegador.
// Este stub evita que o webpack tente resolver o módulo 'canvas' do Node.js no bundle do cliente.

module.exports = {};

