module.exports = {
  plugins: ['prettier', 'import'],
  extends: ['plugin:prettier/recommended', 'plugin:import/recommended'],
  root: true,
  parserOptions: {
    ecmaVersion: 2020,
  },
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['node_modules/'],
  rules: {
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        pathGroups: [
          {
            pattern: '@**',
            group: 'external',
            position: 'after',
          },
        ],
        distinctGroup: false,
      },
    ],
  },
};
