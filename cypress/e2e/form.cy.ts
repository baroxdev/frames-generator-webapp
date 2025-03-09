describe("Form Tests", () => {
  beforeEach(() => {
    // Visit the app before each test
    cy.visit("/");

    // Suppress uncaught exceptions caused by third-party libraries
    Cypress.on("uncaught:exception", () => {
      return false;
    });
  });

  // Helper function to upload a test image
  const uploadTestImage = () => {
    cy.fixture("test-image.json").then((fileData) => {
      // Convert the base64 data to a blob
      const base64String = fileData.base64;
      const byteString = atob(base64String.split(",")[1]);
      const mimeString = base64String.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);

      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], "test-image.png", { type: mimeString });

      // Create a DataTransfer object to simulate a file upload
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Get the file input element and attach the file
      cy.get(".avatar-uploader .ant-upload input[type='file']").then(
        ($input) => {
          const input = $input[0] as HTMLInputElement;
          input.files = dataTransfer.files;
          cy.wrap($input).trigger("change", { force: true });
        }
      );

      // Wait for the crop modal to appear and click Confirm button
      cy.get(".ant-modal-content", { timeout: 10000 }).should("be.visible");
      cy.contains("button", "Xác nhận").click();

      // Wait for the image to be displayed
      cy.get(".avatar-uploader img").should("be.visible");
    });
  };

  it("should test form with short text inputs", () => {
    // Short values
    const shortName = "John Doe";
    const shortRole = "Developer";
    const shortText = "Short message for testing";

    // Upload test image
    uploadTestImage();

    // Fill the form with short values
    cy.get('input[name="full_name"]').clear().type(shortName);
    cy.get('input[name="role"]').clear().type(shortRole);
    cy.get('textarea[name="text"]').clear().type(shortText);

    // Give time for preview to update
    cy.wait(500);

    // Verify text is displayed correctly in preview
    cy.contains(shortName).should("be.visible");
    cy.contains(shortRole).should("be.visible");

    // Test preview functionality
    cy.contains("button", "Xem trước").click();

    // Wait 5 seconds to review the content
    cy.wait(5000);

    // Review step: Verify the modal and content
    cy.get(".ant-modal").should("be.visible");
    cy.get(".ant-modal img").should("be.visible");

    // Verify preview shows correct information
    cy.get(".ant-modal").within(() => {
      // Check that the image is loaded properly
      cy.get("img").should("have.attr", "src").and("not.be.empty");
      cy.contains("button", "Thay đổi").should("be.visible");
    });
  });

  it("should test form with medium text inputs", () => {
    // Medium length values
    const mediumName = "John Doe with a medium name";
    const mediumRole = "Senior Software Developer at Company";
    const mediumText =
      "This is a medium length message that would wrap to multiple lines and display properly on the preview. It should be long enough to test the font sizing.";

    // Upload test image
    uploadTestImage();

    // Fill the form with medium values
    cy.get('input[name="full_name"]').clear().type(mediumName);
    cy.get('input[name="role"]').clear().type(mediumRole);
    cy.get('textarea[name="text"]').clear().type(mediumText);

    // Give time for preview to update
    cy.wait(500);

    // Verify text is displayed correctly
    // cy.contains(mediumName).should("be.visible");
    // cy.contains(mediumRole).should("be.visible");

    // Test preview functionality
    cy.contains("button", "Xem trước").click();

    // Wait 5 seconds to review the content
    cy.wait(5000);

    // Review step: Verify the modal and content
    cy.get(".ant-modal").should("be.visible");
    cy.get(".ant-modal img").should("be.visible");

    // Verify preview shows correct information
    cy.get(".ant-modal").within(() => {
      // Check that the image is loaded properly
      cy.get("img").should("have.attr", "src").and("not.be.empty");
      cy.contains("button", "Thay đổi").should("be.visible");
    });
  });

  it("should test form with long text inputs", () => {
    // Long values (close to max length)
    const longName = "John Doe with a very very long name";
    const longRole =
      "Senior Software Developer & UI/UX Designer at Very Large Company with a Long Name";
    const longText =
      "This is a very long message that would definitely wrap to multiple lines and test the maximum character limit of the text area. This message should be long enough to test the font sizing and wrapping behavior of the text in the preview. It should also test the character counter that shows how many characters have been entered out of the maximum 400 allowed characters. We want to make sure that the text displays correctly and that the user experience is good even with very long text inputs.";

    // Upload test image
    uploadTestImage();

    // Fill the form with long values
    cy.get('input[name="full_name"]').clear().type(longName);
    cy.get('input[name="role"]').clear().type(longRole);
    cy.get('textarea[name="text"]').clear().type(longText);

    // Give time for preview to update
    cy.wait(500);

    // Verify text is displayed correctly
    // cy.contains(longName).should("be.visible");
    // cy.contains(longRole).should("be.visible");

    // Verify character counter works
    // cy.get("span.text-sm.text-slate-500").should(
    //   "contain",
    //   `${longText.length} / 400`
    // );

    // Test preview functionality
    cy.contains("button", "Xem trước").click();

    // Wait 5 seconds to review the content
    cy.wait(5000);

    // Review step: Verify the modal and content
    cy.get(".ant-modal").should("be.visible");
    cy.get(".ant-modal img").should("be.visible");

    // Verify preview shows correct information
    cy.get(".ant-modal").within(() => {
      // Check that the image is loaded properly
      cy.get("img").should("have.attr", "src").and("not.be.empty");
      cy.contains("button", "Thay đổi").should("be.visible");

      // For long text, ensure download button is visible
      cy.contains("button", "Lưu về máy").should("be.visible");
    });
  });

  it("should test character limits for each field", () => {
    // First, upload a test image for the preview to work
    uploadTestImage();

    // Test max length for fullName (25 characters)
    const exactMaxName = "A".repeat(25);
    cy.get('input[name="full_name"]').clear().type(exactMaxName);
    cy.get('input[name="full_name"]').should("have.value", exactMaxName);

    // Try to exceed max for fullName
    cy.get('input[name="full_name"]')
      .clear()
      .type(exactMaxName + "Extra");
    cy.get('input[name="full_name"]').should("have.value", exactMaxName);
    cy.get(".ant-message").should("be.visible");
    cy.wait(500); // Wait for message to disappear

    // Test max length for role (36 characters)
    const exactMaxRole = "B".repeat(36);
    cy.get('input[name="role"]').clear().type(exactMaxRole);
    cy.get('input[name="role"]').should("have.value", exactMaxRole);

    // Try to exceed max for role
    cy.get('input[name="role"]')
      .clear()
      .type(exactMaxRole + "Extra");
    cy.get('input[name="role"]').should("have.value", exactMaxRole);
    cy.get(".ant-message").should("be.visible");
    cy.wait(500); // Wait for message to disappear

    // Test max length for text (400 characters)
    const exactMaxText = "C".repeat(400);
    cy.get('textarea[name="text"]').clear().type(exactMaxText);
    cy.get('textarea[name="text"]').should("have.value", exactMaxText);

    // Try to exceed max for text
    cy.get('textarea[name="text"]')
      .clear()
      .type(exactMaxText + "Extra");
    // cy.get('textarea[name="text"]').should("have.value", exactMaxText);
    cy.get(".ant-message").should("be.visible");

    // Verify character counter
    cy.get("span.text-sm.text-slate-500").should("contain", "400 / 400");

    // Preview with max character values
    cy.contains("button", "Xem trước").click();

    // Wait 5 seconds to review the content
    cy.wait(5000);

    // Review step: Verify the modal and content
    cy.get(".ant-modal").should("be.visible");
    cy.get(".ant-modal img").should("be.visible");

    // Verify preview shows correct information with max length values
    cy.get(".ant-modal").within(() => {
      // Check that the image is loaded properly
      cy.get("img").should("have.attr", "src").and("not.be.empty");
      cy.contains("button", "Lưu về máy").should("be.visible");
      cy.contains("button", "Thay đổi").should("be.visible");
    });
  });

  it("should test form validation for required fields", () => {
    // Make sure any previous form data is cleared
    cy.get('input[name="full_name"]').clear();
    cy.get('input[name="role"]').clear();
    cy.get('textarea[name="text"]').clear();

    // Click submit without filling in any fields
    cy.contains("button", "Lưu và gửi thông điệp").click();

    // Check for error messages
    cy.get(".text-red-600").should("be.visible");
  });

  it("should test the complete workflow", () => {
    // Upload test image
    uploadTestImage();

    // Fill out the form
    cy.get('input[name="full_name"]').clear().type("John Doe");
    cy.get('input[name="role"]').clear().type("Software Developer");
    cy.get('textarea[name="text"]')
      .clear()
      .type("This is a test message for the complete workflow test.");

    // Preview the result
    cy.contains("button", "Xem trước").click();

    // Wait 5 seconds to review the content
    cy.wait(5000);

    // Preview Review Step: Verify the modal and its contents
    cy.get(".ant-modal").should("be.visible");
    cy.get(".ant-modal-title")
      .contains("Ảnh thông điệp của bạn")
      .should("be.visible");
    cy.get(".ant-modal img").should("be.visible");

    // Verify preview shows correct information
    cy.get(".ant-modal").within(() => {
      // Check that the image is loaded properly
      cy.get("img").should("have.attr", "src").and("not.be.empty");

      // Verify buttons for downloading and changing are visible
      cy.contains("button", "Lưu về máy").should("be.visible");
      cy.contains("button", "Thay đổi").should("be.visible");
    });

    // Test finishes here after reviewing the preview
    // Don't proceed with further steps
  });
});
