import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { beaconKey, parseLegacyBeacons, type BeaconRecord } from "../src/beacons/legacy-format.js";
import { snapshotBeaconReader, type BeaconReader } from "../src/beacons/store.js";
import { buildTestApp } from "./helpers/app.js";

// Contrato con la app Android: GET /beacons/:major/:minor debe responder
// exactamente lo mismo que el servidor anterior, que servía beacons.json tal cual.

const ARCHIVO_HISTORICO = path.resolve(
  import.meta.dirname,
  "../../BeaconsAndroid/server/beacons.json",
);
const historico = JSON.parse(readFileSync(ARCHIVO_HISTORICO, "utf-8")) as Record<string, unknown>;
const { beacons } = parseLegacyBeacons(historico);

function lectorEnMemoria(lista: BeaconRecord[]): BeaconReader {
  const mapa = new Map(lista.map((b) => [beaconKey(b.major, b.minor), b]));
  return { find: async (major, minor) => mapa.get(beaconKey(major, minor)) ?? null };
}

const lectorQueFalla: BeaconReader = {
  find: async () => {
    throw new Error("conexión rechazada");
  },
};

function app(primary: BeaconReader, fallback: BeaconReader = lectorQueFalla) {
  return buildTestApp({ beacons: { primary, fallback } });
}

describe("GET /beacons/:major/:minor (contrato Android)", () => {
  const servidor = app(lectorEnMemoria(beacons));

  it("importa todas las entradas del beacons.json actual", () => {
    expect(beacons).toHaveLength(Object.keys(historico).length);
  });

  it.each(Object.keys(historico))("responde %s igual que el servidor anterior", async (clave) => {
    const [major, minor] = clave.split("-");
    const res = await request(servidor).get(`/beacons/${major}/${minor}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(res.body).toStrictEqual(historico[clave]);
  });

  it.each([
    ["/beacons/999/999", "999-999"],
    ["/beacons/abc/1", "abc-1"],
    ["/beacons/01/1", "01-1"],
    ["/beacons/1/70000", "1-70000"],
  ])("%s → 404 con el mismo cuerpo de error", async (ruta, clave) => {
    const res = await request(servidor).get(ruta);
    expect(res.status).toBe(404);
    expect(res.body).toStrictEqual({ error: `No hay información para el beacon ${clave}` });
  });

  it("omite ubicacion cuando la ficha no la tiene", async () => {
    const sinUbicacion = app(
      lectorEnMemoria([{ major: 5, minor: 5, titulo: "T", descripcion: "D", ubicacion: null }]),
    );
    const res = await request(sinUbicacion).get("/beacons/5/5");
    expect(res.body).toStrictEqual({ titulo: "T", descripcion: "D" });
  });

  it("ya no expone el listado ni la escritura sin autenticación", async () => {
    expect((await request(servidor).get("/beacons")).status).toBe(404);
    expect((await request(servidor).post("/beacons/1/1").send({ titulo: "x" })).status).toBe(404);
    expect((await request(servidor).delete("/beacons/1/1")).status).toBe(404);
  });
});

describe("respaldo cuando la base de datos no responde", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "signal-snapshot-"));
  const snapshot = path.join(dir, "beacons.snapshot.json");
  writeFileSync(snapshot, JSON.stringify(historico));

  it("sirve la ficha desde el snapshot local", async () => {
    const [clave] = Object.keys(historico) as [string];
    const [major, minor] = clave.split("-");
    const res = await request(app(lectorQueFalla, snapshotBeaconReader(snapshot))).get(
      `/beacons/${major}/${minor}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual(historico[clave]);
  });

  it("responde 503 si tampoco hay snapshot", async () => {
    const res = await request(
      app(lectorQueFalla, snapshotBeaconReader(path.join(dir, "no-existe.json"))),
    ).get("/beacons/1/1");
    expect(res.status).toBe(503);
  });
});
