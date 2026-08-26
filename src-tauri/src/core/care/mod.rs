// IA Pros Santé : transcription audio 100 % locale via whisper.cpp (doc §4).
// Le binaire (release officielle ggml-org/whisper.cpp) et le modèle
// (huggingface.co/ggerganov/whisper.cpp) sont téléchargés au premier usage
// dans <données Jan>/care/whisper/. L'audio ne quitte jamais le poste.

use std::fs;
use std::path::PathBuf;

use futures_util::StreamExt;
use serde::Serialize;
use tauri::{Emitter, Runtime};

use crate::core::app::commands::get_jan_data_folder_path;

const WHISPER_BIN_URL: &str =
    "https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-bin-x64.zip";
const MODEL_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
// Build officiel (lié depuis ffmpeg.org). Variante LGPL : décodage audio
// complet, licence compatible avec une distribution commerciale.
const FFMPEG_URL: &str =
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n9.0-latest-win64-lgpl-9.0.zip";
// Formats décodés nativement par whisper-cli (miniaudio).
const SUPPORTED_EXTENSIONS: [&str; 4] = ["wav", "mp3", "ogg", "flac"];
// Formats convertis en WAV via ffmpeg avant transcription (m4a = mémos
// vocaux iPhone, le cas réel le plus fréquent).
const CONVERT_EXTENSIONS: [&str; 1] = ["m4a"];
const PROGRESS_EVENT: &str = "care:whisper-progress";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WhisperStatus {
    pub binary_present: bool,
    pub model_present: bool,
    pub ffmpeg_present: bool,
    pub dir: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WhisperProgress {
    stage: String,
    downloaded: u64,
    total: u64,
}

fn whisper_dir<R: Runtime>(app_handle: &tauri::AppHandle<R>) -> PathBuf {
    get_jan_data_folder_path(app_handle.clone())
        .join("care")
        .join("whisper")
}

fn binary_path<R: Runtime>(app_handle: &tauri::AppHandle<R>) -> PathBuf {
    let name = if cfg!(windows) {
        "whisper-cli.exe"
    } else {
        "whisper-cli"
    };
    whisper_dir(app_handle).join("bin").join(name)
}

fn ffmpeg_path<R: Runtime>(app_handle: &tauri::AppHandle<R>) -> PathBuf {
    let name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    whisper_dir(app_handle).join("bin").join(name)
}

// Le nom de modèle vient du front (choisi selon la RAM) ; on le borne à un
// nom de fichier sûr pour interdire toute traversée de chemin.
fn model_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    model: &str,
) -> Result<PathBuf, String> {
    if model.is_empty()
        || !model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        || model.contains("..")
    {
        return Err(format!("Nom de modèle invalide : {model}"));
    }
    Ok(whisper_dir(app_handle)
        .join("models")
        .join(format!("ggml-{model}.bin")))
}

fn status<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    model: &str,
) -> Result<WhisperStatus, String> {
    Ok(WhisperStatus {
        binary_present: binary_path(app_handle).is_file(),
        model_present: model_path(app_handle, model)?.is_file(),
        ffmpeg_present: ffmpeg_path(app_handle).is_file(),
        dir: whisper_dir(app_handle).to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn care_whisper_status<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    model: String,
) -> Result<WhisperStatus, String> {
    status(&app_handle, &model)
}

async fn download_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    url: &str,
    dest: &PathBuf,
    stage: &str,
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let response = reqwest::get(url)
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Téléchargement impossible ({stage}) : {e}"))?;
    let total = response.content_length().unwrap_or(0);

    // Écriture dans un .part renommé à la fin : jamais de fichier tronqué
    // visible sous son nom définitif.
    let part = dest.with_extension("part");
    let mut file = fs::File::create(&part).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emitted: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Téléchargement interrompu ({stage}) : {e}"))?;
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if downloaded - last_emitted >= 5 * 1024 * 1024 {
            last_emitted = downloaded;
            let _ = app_handle.emit(
                PROGRESS_EVENT,
                WhisperProgress {
                    stage: stage.to_string(),
                    downloaded,
                    total,
                },
            );
        }
    }
    drop(file);
    fs::rename(&part, dest).map_err(|e| e.to_string())?;
    let _ = app_handle.emit(
        PROGRESS_EVENT,
        WhisperProgress {
            stage: stage.to_string(),
            downloaded,
            total: downloaded,
        },
    );
    Ok(())
}

// Extrait à plat dans bin/ les entrées retenues par `keep` ; `required`
// doit en faire partie, sinon l'archive est considérée invalide.
fn extract_binaries(
    archive_path: &PathBuf,
    bin_dir: &PathBuf,
    keep: fn(&str) -> bool,
    required: &str,
) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    fs::create_dir_all(bin_dir).map_err(|e| e.to_string())?;
    let mut found_required = false;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(name) = entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        else {
            continue;
        };
        if entry.is_dir() || !keep(&name) {
            continue;
        }
        if name == required {
            found_required = true;
        }
        let mut out = fs::File::create(bin_dir.join(&name)).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    }
    if !found_required {
        return Err(format!("{required} absent de l'archive téléchargée"));
    }
    Ok(())
}

#[tauri::command]
pub async fn care_provision_whisper<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    model: String,
) -> Result<WhisperStatus, String> {
    if !cfg!(windows) {
        return Err("Provisionnement whisper non pris en charge sur cet OS en V1".to_string());
    }
    let dir = whisper_dir(&app_handle);

    if !binary_path(&app_handle).is_file() {
        let archive = dir.join("whisper-bin.zip");
        download_file(&app_handle, WHISPER_BIN_URL, &archive, "binary").await?;
        // Seuls l'exécutable CLI et ses DLL nous servent (pas les autres
        // exemples de la release).
        extract_binaries(
            &archive,
            &dir.join("bin"),
            |name| name == "whisper-cli.exe" || name.ends_with(".dll"),
            "whisper-cli.exe",
        )?;
        let _ = fs::remove_file(&archive);
    }

    if !ffmpeg_path(&app_handle).is_file() {
        let archive = dir.join("ffmpeg.zip");
        download_file(&app_handle, FFMPEG_URL, &archive, "ffmpeg").await?;
        // Build statique : un seul exécutable suffit (ffprobe/ffplay inutiles).
        extract_binaries(&archive, &dir.join("bin"), |name| name == "ffmpeg.exe", "ffmpeg.exe")?;
        let _ = fs::remove_file(&archive);
    }

    let model_file = model_path(&app_handle, &model)?;
    if !model_file.is_file() {
        let url = format!("{MODEL_BASE_URL}/ggml-{model}.bin");
        download_file(&app_handle, &url, &model_file, "model").await?;
    }

    status(&app_handle, &model)
}

fn hide_console(command: &mut tokio::process::Command) {
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    let _ = command;
}

fn stderr_tail(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let mut lines: Vec<&str> = text.lines().rev().take(5).collect();
    lines.reverse();
    lines.join("\n")
}

// m4a → WAV 16 kHz mono via ffmpeg, dans un fichier temporaire du dossier
// whisper (supprimé par l'appelant après transcription).
async fn convert_to_wav<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    input: &PathBuf,
) -> Result<PathBuf, String> {
    let ffmpeg = ffmpeg_path(app_handle);
    if !ffmpeg.is_file() {
        return Err(
            "Conversion audio non installée : relancez l'installation de la transcription"
                .to_string(),
        );
    }
    let converted = whisper_dir(app_handle).join("conversion.wav");
    let mut command = tokio::process::Command::new(&ffmpeg);
    command
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-i")
        .arg(input)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg("-sample_fmt")
        .arg("s16")
        .arg(&converted);
    hide_console(&mut command);
    let output = command
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer ffmpeg : {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "Échec de la conversion audio : {}",
            stderr_tail(&output.stderr)
        ));
    }
    Ok(converted)
}

#[tauri::command]
pub async fn care_transcribe<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    path: String,
    model: String,
    language: Option<String>,
) -> Result<String, String> {
    let audio = PathBuf::from(&path);
    if !audio.is_file() {
        return Err(format!("Fichier audio introuvable : {path}"));
    }
    let extension = audio
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let needs_conversion = CONVERT_EXTENSIONS.contains(&extension.as_str());
    if !needs_conversion && !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "Format .{extension} non pris en charge (formats acceptés : wav, mp3, m4a, ogg, flac)"
        ));
    }

    let binary = binary_path(&app_handle);
    let model_file = model_path(&app_handle, &model)?;
    if !binary.is_file() || !model_file.is_file() {
        return Err("Transcription non installée : lancez d'abord le téléchargement".to_string());
    }

    let temp_wav = if needs_conversion {
        Some(convert_to_wav(&app_handle, &audio).await?)
    } else {
        None
    };
    let input = temp_wav.as_ref().unwrap_or(&audio);

    let threads = std::thread::available_parallelism()
        .map(|n| n.get().min(8))
        .unwrap_or(4);
    let mut command = tokio::process::Command::new(&binary);
    command
        .arg("-m")
        .arg(&model_file)
        .arg("-f")
        .arg(input)
        .arg("-l")
        .arg(language.unwrap_or_else(|| "fr".to_string()))
        .arg("-t")
        .arg(threads.to_string())
        .arg("-nt")
        .arg("-np");
    hide_console(&mut command);
    let output = command
        .output()
        .await
        .map_err(|e| format!("Impossible de lancer whisper-cli : {e}"));
    if let Some(temp) = &temp_wav {
        let _ = fs::remove_file(temp);
    }
    let output = output?;
    if !output.status.success() {
        return Err(format!(
            "Échec de la transcription : {}",
            stderr_tail(&output.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
