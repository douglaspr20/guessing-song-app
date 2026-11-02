-- AlterTable: las partidas que ya existen se grabaron con la pausa al pulsar; las nuevas siguen sonando.
ALTER TABLE "Game" ADD COLUMN     "buzzMode" TEXT NOT NULL DEFAULT 'pause';
ALTER TABLE "Game" ALTER COLUMN "buzzMode" SET DEFAULT 'continue';
