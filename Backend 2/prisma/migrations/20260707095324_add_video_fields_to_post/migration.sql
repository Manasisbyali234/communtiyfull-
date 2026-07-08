-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "videoFileName" TEXT,
ADD COLUMN     "videoUrl" TEXT;
