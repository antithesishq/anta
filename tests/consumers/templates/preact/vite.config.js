import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact(), {
    name: 'anta-dependency-report',
    generateBundle() {
      const modules = [...this.getModuleIds()].filter(id => id.includes('/@antadesign/anta/'));
      this.emitFile({ type: 'asset', fileName: 'dependency-graph.json', source: JSON.stringify(modules, null, 2) });
    },
  }],
});
