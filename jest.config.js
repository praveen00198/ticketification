const path = require('path');
const serverDir = path.resolve(__dirname, 'server');

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/server/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      path.resolve(serverDir, 'node_modules/ts-jest'),
      { isolatedModules: true, tsconfig: path.resolve(serverDir, 'tsconfig.json') },
    ],
  },
  moduleDirectories: ['node_modules', path.resolve(serverDir, 'node_modules')],
  rootDir: '.',
};
