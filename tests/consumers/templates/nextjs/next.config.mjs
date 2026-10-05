import fs from 'node:fs';
import path from 'node:path';

// Turbopack uses the emitted CSS checks. Webpack can also record its module graph.
export default process.env.ANTA_NEXT_COMPILER === 'webpack' ? {
  webpack(config, { isServer }) {
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.done.tap('AntaDependencyReport', stats => {
          const modules = [...stats.compilation.modules]
            .map(module => module.resource)
            .filter(resource => resource?.includes('/@antadesign/anta/'));
          fs.mkdirSync('consumer-graphs', { recursive: true });
          fs.writeFileSync(path.join('consumer-graphs', `${compiler.name || (isServer ? 'server' : 'client')}.json`), JSON.stringify(modules, null, 2));
        });
      },
    });
    return config;
  },
} : {};
