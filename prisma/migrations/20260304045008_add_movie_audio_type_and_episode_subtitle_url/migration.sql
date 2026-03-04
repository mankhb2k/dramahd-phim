-- CreateEnum
CREATE TYPE "MovieAudioType" AS ENUM ('NONE', 'SUB', 'DUBBED');

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "subtitleUrl" TEXT;

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "audioType" "MovieAudioType" NOT NULL DEFAULT 'NONE';
