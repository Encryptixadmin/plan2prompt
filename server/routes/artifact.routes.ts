import { Router } from "express";
import { artifactService } from "../services/artifact.service";
import type { CreateArtifactInput, UpdateArtifactInput } from "@shared/types/artifact";

const router = Router();

// List all artefacts (optionally filtered by module)
router.get("/", async (req, res) => {
  try {
    const module = req.query.module as string | undefined;
    const artifacts = await artifactService.list(module);
    res.json({
      success: true,
      data: artifacts,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LIST_ERROR",
        message: error instanceof Error ? error.message : "Failed to list artefacts",
      },
    });
  }
});

// Get an artefact by ID
router.get("/:id", async (req, res) => {
  try {
    const artifact = await artifactService.getById(req.params.id);
    
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Artefact not found",
        },
      });
    }

    res.json({
      success: true,
      data: artifact,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "GET_ERROR",
        message: error instanceof Error ? error.message : "Failed to get artefact",
      },
    });
  }
});

// Get artefact reference (for module passing)
router.get("/:id/reference", async (req, res) => {
  try {
    const reference = await artifactService.getReference(req.params.id);
    
    if (!reference) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Artefact not found",
        },
      });
    }

    res.json({
      success: true,
      data: reference,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "REFERENCE_ERROR",
        message: error instanceof Error ? error.message : "Failed to get reference",
      },
    });
  }
});

// Get version history for an artefact
router.get("/:id/versions", async (req, res) => {
  try {
    const versions = await artifactService.getVersionHistory(req.params.id);
    
    res.json({
      success: true,
      data: versions,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "VERSION_ERROR",
        message: error instanceof Error ? error.message : "Failed to get version history",
      },
    });
  }
});

// Get downstream artifacts (artifacts derived from this one)
router.get("/:id/downstream", async (req, res) => {
  try {
    const downstream = await artifactService.getDownstreamArtifacts(req.params.id);
    
    res.json({
      success: true,
      data: downstream,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DOWNSTREAM_ERROR",
        message: error instanceof Error ? error.message : "Failed to get downstream artifacts",
      },
    });
  }
});

// Check if artifact has downstream dependencies
router.get("/:id/has-dependencies", async (req, res) => {
  try {
    const hasDependencies = await artifactService.hasDownstreamDependencies(req.params.id);
    
    res.json({
      success: true,
      data: { hasDependencies },
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DEPENDENCY_CHECK_ERROR",
        message: error instanceof Error ? error.message : "Failed to check dependencies",
      },
    });
  }
});

// Load artefact by file path
router.get("/path/*", async (req, res) => {
  try {
    const filePath = req.params[0];
    const artifact = await artifactService.getByPath(filePath);
    
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Artefact not found at path",
        },
      });
    }

    res.json({
      success: true,
      data: artifact,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PATH_ERROR",
        message: error instanceof Error ? error.message : "Failed to load artefact by path",
      },
    });
  }
});

// Create a new artefact
router.post("/", async (req, res) => {
  try {
    const input: CreateArtifactInput = req.body;

    // Basic validation
    if (!input.title || !input.module || !input.sections) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: title, module, sections",
        },
      });
    }

    const artifact = await artifactService.create(input);
    
    res.status(201).json({
      success: true,
      data: artifact,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "CREATE_ERROR",
        message: error instanceof Error ? error.message : "Failed to create artefact",
      },
    });
  }
});

// Update an artefact (creates new version)
router.put("/:id", async (req, res) => {
  try {
    const input: UpdateArtifactInput = req.body;
    const artifact = await artifactService.update(req.params.id, input);
    
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Artefact not found",
        },
      });
    }

    res.json({
      success: true,
      data: artifact,
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "UPDATE_ERROR",
        message: error instanceof Error ? error.message : "Failed to update artefact",
      },
    });
  }
});

export default router;
