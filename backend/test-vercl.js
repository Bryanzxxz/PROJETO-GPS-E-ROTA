const url = 'https://projeto-gps-e-rota.vercel.app/tecnicos';

fetch(url)
  .then(res => res.text())
  .then(text => console.log('RESPONSE:', text))
  .catch(err => console.error('ERR:', err));
