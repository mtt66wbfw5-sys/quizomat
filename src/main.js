import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import './app.js';

registerSW({ immediate: true });
