import './style.css';
import { GAME_TITLE } from './title';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  const heading = document.createElement('h1');
  heading.textContent = GAME_TITLE;
  app.appendChild(heading);
}
