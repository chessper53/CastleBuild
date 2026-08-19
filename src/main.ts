import Phaser from 'phaser';
import { TerrainScene } from './game/scenes/TerrainScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b0f0a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TerrainScene],
});
