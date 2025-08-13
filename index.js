const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./db-config");
const { scrapeLegoData } = require("./webScrapping");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/nombres-columnas", async (req, res) => {
  try {
    const query =
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'lego' ORDER BY ordinal_position";
    const result = (await pool.query(query)).rows;

    res
      .status(200)
      .send({ columnas: result.map((column) => column.column_name) });
  } catch (error) {
    console.error("Error al obtener los nombres de las columnas", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/opciones/:columna/:valor", async (req, res) => {
  try {
    const { columna, valor } = req.params;

    if (!columna || !valor) {
      return res
        .status(400)
        .send({ message: "Faltan datos en la consulta", data: [] });
    }

    const query = `SELECT DISTINCT ${columna} FROM lego WHERE ${columna} ILIKE $1 ORDER BY ${columna}`;
    const result = (await pool.query(query, [`%${valor}%`])).rows;

    if (result.length === 0) {
      return res
        .status(400)
        .send({ message: "No existen opciones para el valor", data: [] });
    }

    res.status(200).send({
      message: "Opciones encontradas",
      data: result.map((opcion) => opcion[columna]),
    });
  } catch (error) {
    console.error("Error al obtener las opciones:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/resultados/:columna/:valor", async (req, res) => {
  try {
    const { columna, valor } = req.params;
    const { page, pageSize } = req.query;

    if (!columna || !valor || !page || !pageSize) {
      return res
        .status(400)
        .send({ message: "Faltan datos en la consulta", data: [] });
    }

    const offset = (page - 1) * pageSize;

    const query = `SELECT * FROM lego WHERE ${columna} = $1 ORDER BY id LIMIT $2 OFFSET $3`;
    const result = (await pool.query(query, [valor, pageSize, offset])).rows;

    if (result.length === 0) {
      return res
        .status(400)
        .send({ message: "No se encontraron resultados", data: [] });
    }

    const totalLegos = (
      await pool.query(`SELECT COUNT(*) FROM lego WHERE ${columna} = $1`, [
        valor,
      ])
    ).rows[0].count;
    const totalPages = Math.ceil(totalLegos / pageSize);

    const imgData = await scrapeLegoData(result);

    res.status(200).send({
      message: "Legos encontrados",
      data: result,
      imgData,
      pagination: {
        page,
        pageSize,
        totalLegos: totalLegos,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error al buscar resultados:", error);
    res.status(500).send({ message: "Internal Server Error:", error });
  }
});

app.put("/editar", async (req, res) => {
  try {
    const { legoData } = req.body;

    if (!legoData) {
      return res.status(400).send({ message: "Faltan valores en la consulta" });
    }

    const { id, ...fields } = legoData;

    // Filtrar campos con valores válidos
    const validEntries = Object.entries(fields).filter(
      ([_, value]) => value !== undefined && value !== null && value !== ""
    );

    if (validEntries.length === 0) {
      return res
        .status(400)
        .send({ message: "No hay campos válidos para actualizar" });
    }

    // Preparar la parte SET de la consulta
    const setClause = validEntries
      .map(([column], index) => `"${column}" = $${index + 1}`)
      .join(", ");

    // Obtener los valores en el orden correcto
    const values = validEntries.map(([_, value]) => value);
    values.push(id); // Añadir el ID al final para el WHERE

    // Crear la consulta con un solo UPDATE
    const query = `UPDATE lego SET ${setClause} WHERE id = $${values.length} RETURNING *`;

    console.log(query); // Para depuración

    // Ejecutar un solo UPDATE con todos los campos
    const result = await pool.query(query, values);

    const imgData = await scrapeLegoData([legoData]);

    res.status(200).send({
      message: "Lego editado correctamente",
      data: result.rows[0],
      imgData,
    });
  } catch (error) {
    console.error("Error al editar lego:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/agregar", async (req, res) => {
  try {
    const { legoData } = req.body;

    if (!legoData) {
      return res
        .status(400)
        .send({ message: "Faltan datos en la consulta", data: [] });
    }

    // Filtrar propiedades con valores válidos
    const validEntries = Object.entries(legoData).filter(
      ([_, value]) => value !== undefined && value !== null && value !== ""
    );

    // Preparar columnas (escapando nombres)
    const columns = validEntries.map(([column]) => `"${column}"`).join(",");

    // Preparar placeholders para valores ($1, $2, etc.)
    const placeholders = validEntries.map((_, i) => `$${i + 1}`).join(",");

    // Obtener valores
    const values = validEntries.map(([_, value]) => value);

    const query = `INSERT INTO lego (${columns}) VALUES (${placeholders}) RETURNING *`;
    console.log(query);

    // Pasar los valores como parámetros separados
    const result = (await pool.query(query, values)).rows;

    const imgData = await scrapeLegoData([legoData]);

    res
      .status(201)
      .send({ message: "Lego agregado correctamente", data: result, imgData });
  } catch (error) {
    console.error("Error al agregar lego:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.delete("/eliminar/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = "DELETE FROM lego WHERE id = $1";
    await pool.query(query, [id]);

    res.status(201).send({ message: "Lego eliminado correctamente " });
  } catch (error) {
    console.error("Error in delete route:", error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running in http://localhost:3000`);
});
