export default {
  multipass: true,
  js2svg: {
    indent: 2,
    pretty: true
  },
  plugins: [
    "preset-default",
    "removeDimensions",
    "removeComments",
    {
      name: "removeAttrs",
      params: {
        attrs: ["data-name"]
      }
    }
  ]
};
