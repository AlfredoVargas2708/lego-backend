const axios = require("axios");
const cheerio = require("cheerio");

const config = {
  legoBaseUrl: "https://www.lego.com/service/building-instructions/",
  codeImageBaseUrl:
    "https://www.lego.com/cdn/product-assets/element.img.photoreal.192x192/",
  notFoundImage:
    "https://www.lego.com/cdn/cs/set/assets/blt25ecf37f37849299/one_missing_brick.webp?format=webply&fit=bounds&quality=75&width=500&height=500&dpr=1",
  notFoundLego: "https://www.lego.com/service/building-instructions/1",
};

const countOccurrences = (array) => {
  return array.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});
};

const scrapeLegoData = async (legoData) => {
  try {
    legoData = legoData.map((lego) => {
      return {
        ...lego,
        pieza: lego.pieza !== null ? lego.pieza : '',
        lego: lego.lego !== null ? lego.lego : '',
      }
    });
    if (legoData.length > 1) {
      const legos = legoData.length > 0 ? legoData.map((lego) => lego.lego) : legoData.lego
      const legoOpciones = Object.keys(countOccurrences(legos))

      const piezas = legoData.length > 0 ? legoData.map((lego) => lego.pieza) : legoData.pieza;
      const piezasOpciones = Object.keys(countOccurrences(piezas));

      const legoImages = await Promise.all(legoOpciones.map(async (lego) => {
          const url = lego !== '' ? `${config.legoBaseUrl}${lego}` : config.notFoundLego;
          
          const { data } = await axios.get(url);
          const $ = cheerio.load(data);
          const imageElement = `${$('source[type="image/webp"]').first().attr("srcset").split(",")[0].split(" ")[0]}`;
          return { url: imageElement, lego };
      }));

      const piezaImages = piezasOpciones.map((pieza) => {
        return pieza !== '' ? { url: `${config.codeImageBaseUrl}${pieza}.jpg`, pieza }: { url: config.notFoundImage, pieza : '' };
      });

      return { legoImages, piezaImages }; 
    }
     else if (legoData.length === 1){
      const lego = legoData[0].lego;
      const pieza = legoData[0].pieza;

      const { data } = await axios.get(lego !== '' ? `${config.legoBaseUrl}${lego}` : config.notFoundLego);
      const $ = cheerio.load(data);

      const imgLego = `${$('source[type="image/webp"]').first().attr("srcset").split(",")[0].split(" ")[0]}`;
      const imgPiece = pieza !== '' ? `${config.codeImageBaseUrl}${pieza}.jpg` : config.notFoundImage

      return { imgLego, imgPiece }
    }
  } catch (error) {
    console.error('Error en realizar scrapping:', error);
    return [];
  }
}

module.exports = { scrapeLegoData }